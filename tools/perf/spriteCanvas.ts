/** Unshipped instanced sprite comparison: upload each bitmap once, then draw one bounded viewport batch. */
export function spriteCanvas(node: HTMLCanvasElement, dpr: number) {
  const gl = node.getContext('webgl2', { alpha: true, premultipliedAlpha: true, antialias: false })!
  if (!gl) throw new Error('WebGL2 comparison unavailable')
  const compile = (kind: number, source: string) => {
    const shader = gl.createShader(kind)!
    gl.shaderSource(shader, source)
    gl.compileShader(shader)
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader) || 'Shader compile failed')
    return shader
  }
  const vertex = compile(gl.VERTEX_SHADER, `#version 300 es
  precision highp float;
  layout(location=0) in vec4 rect;
  layout(location=1) in vec4 uv;
  layout(location=2) in float alpha;
  uniform vec2 viewport;
  out vec2 texcoord;
  out float opacity;
  const vec2 corners[6]=vec2[6](vec2(0,0),vec2(1,0),vec2(0,1),vec2(0,1),vec2(1,0),vec2(1,1));
  void main(){ vec2 c=corners[gl_VertexID]; vec2 p=rect.xy+c*rect.zw; gl_Position=vec4(p.x/viewport.x*2.-1.,1.-p.y/viewport.y*2.,0,1); texcoord=(uv.xy+c*uv.zw)/vec2(2048,4096); opacity=alpha; }`)
  const fragment = compile(gl.FRAGMENT_SHADER, `#version 300 es
  precision highp float;
  uniform sampler2D sprites;
  in vec2 texcoord;
  in float opacity;
  out vec4 color;
  void main(){ color=texture(sprites,texcoord)*opacity; }`)
  const program=gl.createProgram()!
  gl.attachShader(program,vertex); gl.attachShader(program,fragment); gl.linkProgram(program)
  if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(program)||'Shader link failed')
  gl.useProgram(program)
  const texture=gl.createTexture()!,buffer=gl.createBuffer()!,vao=gl.createVertexArray()!
  gl.bindTexture(gl.TEXTURE_2D,texture)
  gl.texStorage2D(gl.TEXTURE_2D,1,gl.RGBA8,2048,4096)
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE)
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,true)
  gl.bindVertexArray(vao);gl.bindBuffer(gl.ARRAY_BUFFER,buffer)
  for(const [location,size,offset] of [[0,4,0],[1,4,16],[2,1,32]]) {
    gl.enableVertexAttribArray(location);gl.vertexAttribPointer(location,size,gl.FLOAT,false,36,offset);gl.vertexAttribDivisor(location,1)
  }
  gl.enable(gl.BLEND);gl.blendFunc(gl.ONE,gl.ONE_MINUS_SRC_ALPHA)
  const viewport=gl.getUniformLocation(program,'viewport')
  const slots=new WeakMap<ImageBitmap,{x:number;y:number;width:number;height:number}>()
  let x=1,y=1,rowHeight=0
  const batch:number[]=[]
  const upload=(bitmap:ImageBitmap)=>{
    if(slots.has(bitmap))return
    const width=bitmap.width,height=bitmap.height
    if(x+width+1>2048){x=1;y+=rowHeight+2;rowHeight=0}
    if(y+height+1>4096)throw new Error('Bounded sprite comparison atlas exhausted')
    gl.bindTexture(gl.TEXTURE_2D,texture)
    gl.texSubImage2D(gl.TEXTURE_2D,0,x,y,gl.RGBA,gl.UNSIGNED_BYTE,bitmap)
    slots.set(bitmap,{x,y,width,height});x+=width+2;rowHeight=Math.max(rowHeight,height)
  }
  const ctx={
    globalAlpha:1,
    setTransform(..._args:number[]){},
    clearRect(..._args:number[]){batch.length=0},
    drawImage(bitmap:ImageBitmap,left:number,top:number,width:number,height:number){
      upload(bitmap)
      const slot=slots.get(bitmap)!
      batch.push(left,top,width,height,slot.x,slot.y,slot.width,slot.height,ctx.globalAlpha)
    },
    upload,
    flush(){
      gl.viewport(0,0,node.width,node.height);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT)
      gl.useProgram(program);gl.bindVertexArray(vao);gl.bindTexture(gl.TEXTURE_2D,texture);gl.bindBuffer(gl.ARRAY_BUFFER,buffer)
      gl.uniform2f(viewport,node.width/dpr,node.height/dpr)
      gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(batch),gl.DYNAMIC_DRAW)
      gl.drawArraysInstanced(gl.TRIANGLES,0,6,batch.length/9)
    },
    close(){gl.deleteTexture(texture);gl.deleteBuffer(buffer);gl.deleteVertexArray(vao);gl.deleteProgram(program);gl.deleteShader(vertex);gl.deleteShader(fragment)},
  }
  return ctx
}
