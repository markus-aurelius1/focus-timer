/** Unshipped worker lettering candidate; uses the application's exact bundled Manrope files. */
import latin from '@fontsource-variable/manrope/files/manrope-latin-wght-normal.woff2?url'
import extended from '@fontsource-variable/manrope/files/manrope-latin-ext-wght-normal.woff2?url'
const loaded = Promise.all(
  [
    ['url(' + latin + ')', 'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD'],
    [
      'url(' + extended + ')',
      'U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF',
    ],
  ].map(async ([source, unicodeRange]) => {
    const font = new FontFace('Manrope', source, { weight: '200 800', unicodeRange })
    await font.load()
    self.fonts.add(font)
  }),
)
const canvas = new OffscreenCanvas(1, 1),
  ctx = canvas.getContext('2d', { willReadFrequently: true })!
self.onmessage = async (event) => {
  await loaded
  const { id, word, dpr } = event.data
  canvas.width = Math.ceil(word.width * dpr)
  canvas.height = Math.ceil(word.height * dpr)
  ctx.scale(dpr, dpr)
  ctx.font = word.font
  ctx.letterSpacing = word.spacing + 'px'
  ctx.textBaseline = 'alphabetic'
  ctx.textAlign = word.curve ? 'center' : 'left'
  ctx.lineJoin = 'round'
  ctx.strokeStyle = word.halo
  ctx.fillStyle = word.color
  ctx.lineWidth = word.haloWidth
  for (const stroke of [true, false]) {
    if (word.curve) {
      for (let i = 0; i < word.glyphs.length; i++) {
        const g = word.glyphs[i]
        ctx.save()
        ctx.translate(g.x - word.minX, g.y - word.minY)
        ctx.rotate(g.angle)
        if (stroke) ctx.strokeText([...word.text][i], 0, 0)
        else ctx.fillText([...word.text][i], 0, 0)
        ctx.restore()
      }
    } else if (stroke) ctx.strokeText(word.text, 3, word.baseline + 3)
    else ctx.fillText(word.text, 3, word.baseline + 3)
  }
  const bitmap = canvas.transferToImageBitmap()
  self.postMessage({ id, bitmap }, [bitmap])
}
