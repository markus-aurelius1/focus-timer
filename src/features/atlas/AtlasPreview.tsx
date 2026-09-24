import { useState } from 'react'
import { useSheet } from '@/atlas/sheet'
import type { SheetId } from '@/atlas/types'
import { AtlasMap, type Plate } from './AtlasMap'

export default function AtlasPreview() {
  const [sheetId, setSheetId] = useState<SheetId>((new URLSearchParams(location.hash.split('?')[1]).get('sheet') as SheetId) || 'india')
  const [plate, setPlate] = useState<Plate>((new URLSearchParams(location.hash.split('?')[1]).get('plate') as Plate) || 'physical')
  const { sheet } = useSheet(sheetId)
  const fog = new URLSearchParams(location.hash.split('?')[1]).get('fog') === '1'
  const explored = fog ? new Set(['sikkim', 'uttarakhand', 'himachal-pradesh', 'ladakh', 'jammu-and-kashmir', 'arunachal-pradesh', 'assam', 'west-bengal', 'delhi', 'uttar-pradesh']) : null
  return (
    <div className="h-[calc(100dvh-84px)] lg:h-dvh">
      {sheet && <AtlasMap sheet={sheet} plate={plate} explored={explored} places={[]} />}
      <div className="absolute top-3 right-3 z-10 flex gap-2" data-map-ui>
        <button className="rounded bg-white px-2 py-1 text-xs" onClick={() => setSheetId(sheetId === 'india' ? 'world' : 'india')}>{sheetId}</button>
        <button className="rounded bg-white px-2 py-1 text-xs" onClick={() => setPlate(plate === 'physical' ? 'political' : 'physical')}>{plate}</button>
      </div>
    </div>
  )
}
