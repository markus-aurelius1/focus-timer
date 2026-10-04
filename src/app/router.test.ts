// @vitest-environment happy-dom
import { describe,expect,it } from 'vitest'
import { navigate,currentRoute,ROUTES } from './router'
describe('Atlas + News routing',()=>{
  it('opens Atlas for every removed route, dropping unsafe legacy parameters',()=>{
    for(const path of ['','home','focus?start=1','tasks?add=1','calendar?block=old','insights','notes','unknown']) {
      navigate('#/'+path,{replace:true})
      expect(currentRoute().name).toBe('atlas')
      expect(location.hash).toBe('#/atlas')
      expect(currentRoute().params.size).toBe(0)
    }
  })
  it('preserves supported deep links and has only two workspaces plus settings',()=>{
    expect(ROUTES).toEqual(['atlas','current-affairs','settings'])
    navigate('#/atlas?place=in.pass.nathu-la',{replace:true})
    expect(currentRoute().params.get('place')).toBe('in.pass.nathu-la')
    navigate('#/current-affairs',{replace:true})
    expect(currentRoute().name).toBe('current-affairs')
  })
})
