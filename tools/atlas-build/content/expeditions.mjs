/**
 * Expeditions: chapters of stops. `minutes` is the focus time needed to travel
 * from the previous stop (20–60 depending on distance and difficulty).
 * Stop ids are place ids without the sheet prefix.
 */
const s = (place, minutes) => ({ place, minutes })

export default [
  {
    id: 'himalayan',
    title: 'Himalayan Expedition',
    subtitle: 'From the Karakoram to the Mishmi hills',
    sheet: 'india',
    color: '#2f5f98',
    reward: { title: 'Silk Route journal', body: 'The Silk Route over Nathu La appears on your map, and a snow leopard watches from Hemis.', icon: 'mountain' },
    chapters: [
      { id: 'kashmir', title: 'Kashmir and the Pir Panjal', stops: [s('capital.jammu', 20), s('pass.banihal-pass', 30), s('valley.kashmir-valley', 30), s('lake.dal-lake', 20), s('lake.wular-lake', 25), s('range.pir-panjal', 30), s('pass.pir-panjal-pass', 30)] },
      { id: 'ladakh', title: 'Ladakh and the Karakoram', stops: [s('pass.zoji-la', 40), s('city.dras', 25), s('city.kargil', 25), s('capital.leh', 45), s('confluence.nimmu', 20), s('pass.khardung-la', 40), s('valley.nubra-valley', 30), s('glacier.siachen-glacier', 60), s('range.karakoram', 45), s('pass.karakoram-pass', 50), s('pass.chang-la', 40), s('lake.pangong-tso', 30), s('lake.tso-moriri', 40), s('park.hemis-national-park', 30)] },
      { id: 'himachal', title: 'Himachal: passes and valleys', stops: [s('pass.baralacha-la', 50), s('confluence.tandi', 30), s('pass.rohtang-pass', 30), s('valley.kullu-valley', 25), s('park.great-himalayan-national-park', 30), s('capital.shimla', 40), s('pass.shipki-la', 50), s('valley.spiti-valley', 40), s('peak.reo-purgyil', 40)] },
      { id: 'garhwal', title: 'Garhwal and Kumaon', stops: [s('capital.dehradun', 45), s('glacier.gangotri-glacier', 50), s('glacier.yamunotri-glacier', 40), s('monument.kedarnath', 40), s('monument.badrinath', 35), s('pass.mana-pass', 30), s('park.valley-of-flowers', 30), s('peak.nanda-devi', 45), s('pass.lipulekh-pass', 55), s('park.jim-corbett-national-park', 50)] },
      { id: 'sikkim', title: 'Sikkim and the Eastern Himalaya', stops: [s('city.darjeeling', 60), s('peak.sandakphu', 25), s('peak.kangchenjunga', 45), s('glacier.zemu-glacier', 35), s('capital.gangtok', 30), s('pass.nathu-la', 30), s('pass.jelep-la', 20)] },
      { id: 'arunachal', title: 'Arunachal: the eastern arc', stops: [s('pass.sela-pass', 60), s('city.tawang', 25), s('pass.bum-la', 25), s('peak.kangto', 45), s('river.siang', 55), s('range.mishmi-hills', 45), s('pass.diphu-pass', 50)] },
    ],
  },
  {
    id: 'rivers',
    title: 'Indian River Journey',
    subtitle: 'Ganga, Yamuna and Brahmaputra from source to sea',
    sheet: 'india',
    color: '#1f6fb2',
    reward: { title: 'River pilot’s log', body: 'The great rivers shimmer with current on your map.', icon: 'waves' },
    chapters: [
      { id: 'headwaters', title: 'The headwaters of the Ganga', stops: [s('glacier.gangotri-glacier', 20), s('river.bhagirathi', 30), s('dam.tehri-dam', 25), s('river.alaknanda', 35), s('confluence.rudraprayag', 20), s('confluence.devprayag', 25), s('city.haridwar', 30)] },
      { id: 'yamuna', title: 'Yamuna and its southern tributaries', stops: [s('glacier.yamunotri-glacier', 40), s('river.yamuna', 40), s('capital.new-delhi', 45), s('city.agra', 40), s('river.chambal', 40), s('park.national-chambal-sanctuary', 25), s('confluence.pachnada', 30), s('river.betwa', 35), s('river.ken', 30)] },
      { id: 'middle-ganga', title: 'The middle Ganga', stops: [s('river.ramganga', 40), s('city.kanpur', 35), s('confluence.triveni-sangam', 40), s('city.varanasi', 35), s('river.gomti', 30), s('river.son', 35), s('river.ghaghara', 30), s('river.gandak', 30), s('capital.patna', 25), s('river.kosi', 35)] },
      { id: 'delta', title: 'To the Bay of Bengal', stops: [s('dam.farakka-barrage', 40), s('river.hooghly', 35), s('capital.kolkata', 30), s('wetland.east-kolkata-wetlands', 15), s('port.haldia', 25), s('park.sundarbans-national-park', 35), s('delta.sundarbans-delta', 25)] },
      { id: 'brahmaputra', title: 'The Brahmaputra', stops: [s('river.siang', 60), s('confluence.sadiya', 35), s('river.lohit', 25), s('city.dibrugarh', 30), s('island.majuli', 30), s('park.kaziranga-national-park', 30), s('river.subansiri', 30), s('city.guwahati', 35), s('park.manas-national-park', 30), s('river.teesta', 45)] },
    ],
  },
  {
    id: 'peninsula',
    title: 'Peninsular India',
    subtitle: 'Plateaus, rift valleys and the rivers of the Deccan',
    sheet: 'india',
    color: '#9a5a1c',
    reward: { title: 'Surveyor’s field book', body: 'Tigers return to Kanha and the Deccan fills with roads and towns.', icon: 'compass' },
    chapters: [
      { id: 'central-highlands', title: 'The central highlands', stops: [s('range.aravalli', 30), s('peak.guru-shikhar', 30), s('plateau.malwa-plateau', 40), s('range.vindhya', 30), s('plateau.bundelkhand', 35), s('monument.bhimbetka', 25), s('plateau.amarkantak-plateau', 45)] },
      { id: 'rift-valleys', title: 'Narmada and Tapi', stops: [s('river.narmada', 30), s('waterfall.dhuandhar-falls', 25), s('range.satpura', 30), s('peak.dhupgarh', 25), s('park.kanha-national-park', 35), s('dam.indira-sagar-dam', 35), s('river.tapi', 40), s('dam.sardar-sarovar-dam', 35)] },
      { id: 'godavari', title: 'The Godavari basin', stops: [s('city.nashik', 45), s('river.godavari', 30), s('monument.ajanta-caves', 30), s('lake.lonar-lake', 30), s('river.wardha', 35), s('river.wainganga', 30), s('river.indravati', 40), s('waterfall.chitrakote-falls', 20), s('dam.polavaram-project', 45)] },
      { id: 'krishna', title: 'The Krishna basin', stops: [s('river.koyna', 45), s('river.krishna', 30), s('river.bhima', 35), s('river.tungabhadra', 40), s('monument.hampi', 20), s('dam.srisailam-dam', 40), s('dam.nagarjuna-sagar-dam', 25), s('range.nallamala-hills', 25)] },
      { id: 'kaveri', title: 'The Kaveri and the southern hills', stops: [s('river.kaveri', 45), s('dam.krishna-raja-sagara', 25), s('waterfall.shivanasamudra-falls', 25), s('range.nilgiri-hills', 40), s('dam.mettur-dam', 30), s('dam.grand-anicut', 35), s('delta.kaveri-delta', 25)] },
      { id: 'ghats', title: 'Along the Western Ghats', stops: [s('range.western-ghats', 45), s('waterfall.jog-falls', 35), s('pass.palghat-gap', 45), s('peak.anamudi', 30), s('park.silent-valley-national-park', 30), s('park.periyar-tiger-reserve', 35), s('range.eastern-ghats', 60)] },
    ],
  },
  {
    id: 'northeast',
    title: 'Northeast India',
    subtitle: 'The seven sisters and Sikkim',
    sheet: 'india',
    color: '#2e7d4f',
    reward: { title: 'Hornbill feather', body: 'Rhinos graze at Kaziranga and hornbills circle the Patkai.', icon: 'feather' },
    chapters: [
      { id: 'gateway', title: 'The gateway', stops: [s('region.siliguri-corridor', 30), s('city.guwahati', 45), s('capital.dispur', 10), s('park.kaziranga-national-park', 35), s('range.karbi-anglong-hills', 25)] },
      { id: 'meghalaya', title: 'Meghalaya, the abode of clouds', stops: [s('capital.shillong', 35), s('range.khasi-hills', 20), s('city.sohra', 25), s('waterfall.nohkalikai-falls', 15), s('city.mawsynram', 20), s('range.garo-hills', 40), s('range.jaintia-hills', 35)] },
      { id: 'hills', title: 'The Purvanchal hills', stops: [s('capital.kohima', 50), s('peak.saramati', 40), s('capital.imphal', 40), s('lake.loktak-lake', 25), s('park.keibul-lamjao-national-park', 15), s('capital.aizawl', 50), s('peak.phawngpui', 35), s('capital.agartala', 50), s('wetland.rudrasagar-lake', 20), s('river.barak', 40)] },
      { id: 'arunachal', title: 'Arunachal and the far east', stops: [s('capital.itanagar', 50), s('river.subansiri', 35), s('park.namdapha-national-park', 55), s('range.patkai', 30), s('pass.pangsau-pass', 25), s('island.majuli', 50)] },
    ],
  },
  {
    id: 'coast',
    title: 'Coastal India',
    subtitle: '7,500 km from Kutch to the Sundarbans',
    sheet: 'india',
    color: '#0e7c86',
    reward: { title: 'Lighthouse keeper’s chart', body: 'Ships sail from your developed ports and lighthouses mark the coast.', icon: 'anchor' },
    chapters: [
      { id: 'gujarat', title: 'Kutch and Kathiawar', stops: [s('region.sir-creek', 30), s('desert.rann-of-kutch', 30), s('monument.dholavira', 25), s('port.deendayal-port', 30), s('gulf.gulf-of-kutch', 20), s('region.kathiawar-peninsula', 35), s('park.gir-national-park', 30), s('gulf.gulf-of-khambhat', 35), s('monument.lothal', 20)] },
      { id: 'west', title: 'Konkan and Malabar', stops: [s('port.jawaharlal-nehru-port', 50), s('capital.mumbai', 15), s('coast.konkan-coast', 40), s('port.mormugao-port', 45), s('coast.kanara-coast', 35), s('port.new-mangalore-port', 30), s('coast.malabar-coast', 40), s('city.kochi', 35), s('lake.vembanad-lake', 20), s('port.vizhinjam-port', 45), s('cape.kanyakumari', 30)] },
      { id: 'south', title: 'Mannar and Palk', stops: [s('gulf.gulf-of-mannar', 30), s('port.tuticorin', 25), s('island.rameswaram', 30), s('region.adams-bridge', 20), s('strait.palk-strait', 25), s('cape.point-calimere', 30)] },
      { id: 'east', title: 'Coromandel to the Circars', stops: [s('coast.coromandel-coast', 35), s('monument.mahabalipuram', 30), s('capital.chennai', 25), s('lake.pulicat-lake', 25), s('island.sriharikota', 15), s('delta.krishna-delta', 45), s('delta.godavari-delta', 30), s('port.visakhapatnam-port', 40)] },
      { id: 'odisha', title: 'Odisha and Bengal', stops: [s('lake.chilika-lake', 45), s('monument.konark-sun-temple', 30), s('port.paradip-port', 30), s('island.abdul-kalam-island', 25), s('park.gahirmatha-marine-sanctuary', 20), s('park.bhitarkanika-national-park', 20), s('port.kolkata-port', 50)] },
    ],
  },
  {
    id: 'islands',
    title: 'Indian Islands',
    subtitle: 'Andaman and Nicobar, Lakshadweep and the river islands',
    sheet: 'india',
    color: '#b5561f',
    reward: { title: 'Coral atlas', body: 'Coral reefs bloom around your mastered islands.', icon: 'shell' },
    chapters: [
      { id: 'andaman', title: 'The Andamans', stops: [s('capital.sri-vijaya-puram', 60), s('island.netaji-subhas-chandra-bose-dweep', 15), s('park.mahatma-gandhi-marine-national-park', 20), s('island.swaraj-dweep', 25), s('island.shaheed-dweep', 15), s('volcano.barren-island', 40), s('volcano.narcondam', 40), s('peak.saddle-peak', 35), s('strait.coco-channel', 30), s('island.north-sentinel-island', 45), s('strait.duncan-passage', 30)] },
      { id: 'nicobar', title: 'The Nicobars', stops: [s('strait.ten-degree-channel', 40), s('island.nicobar-islands', 35), s('island.great-nicobar', 45), s('cape.indira-point', 25), s('strait.great-channel', 30)] },
      { id: 'lakshadweep', title: 'Lakshadweep', stops: [s('island.lakshadweep-islands', 60), s('capital.kavaratti', 15), s('strait.nine-degree-channel', 35), s('island.minicoy', 25), s('strait.eight-degree-channel', 30)] },
      { id: 'rivers-coast', title: 'River and coastal islands', stops: [s('island.elephanta-island', 60), s('island.diu', 40), s('island.majuli', 60), s('island.umananda', 25)] },
    ],
  },
  {
    id: 'world',
    title: 'World Physical Geography',
    subtitle: 'Chokepoints, great rivers, mountains and deserts',
    sheet: 'world',
    color: '#5b3f9a',
    reward: { title: 'Navigator’s globe', body: 'Shipping lanes trace the chokepoints across your world map.', icon: 'globe' },
    chapters: [
      { id: 'chokepoints', title: 'The chokepoints', stops: [s('strait.strait-of-hormuz', 30), s('gulf.persian-gulf', 20), s('port.chabahar', 25), s('strait.bab-el-mandeb', 45), s('sea.red-sea', 25), s('canal.suez-canal', 30), s('strait.bosporus', 40), s('strait.strait-of-gibraltar', 45), s('strait.strait-of-malacca', 60), s('capital.singapore', 15), s('canal.panama-canal', 60)] },
      { id: 'mountains', title: 'Roof of the world and beyond', stops: [s('range.himalaya', 30), s('range.pamir', 30), s('plateau.tibetan-plateau', 30), s('range.alps', 50), s('peak.mount-elbrus', 40), s('peak.kilimanjaro', 50), s('range.andes', 60), s('peak.aconcagua', 30), s('peak.denali', 55)] },
      { id: 'rivers', title: 'The great rivers', stops: [s('river.nile', 40), s('lake.lake-victoria', 30), s('river.congo', 40), s('river.amazon', 55), s('river.mississippi', 45), s('river.danube', 50), s('river.volga', 35), s('river.yangtze', 50), s('river.mekong', 35)] },
      { id: 'deserts', title: 'Deserts and grasslands', stops: [s('desert.sahara', 40), s('region.sahel', 25), s('desert.arabian-desert', 40), s('desert.gobi-desert', 50), s('grassland.steppes', 35), s('desert.atacama-desert', 60), s('grassland.pampas', 30), s('grassland.prairies', 50), s('grassland.veld', 55)] },
      { id: 'lakes-islands', title: 'Lakes, reefs and islands', stops: [s('lake.caspian-sea', 40), s('lake.lake-baikal', 45), s('lake.dead-sea', 45), s('island.madagascar', 45), s('island.maldives', 35), s('region.great-barrier-reef', 55), s('island.greenland', 60)] },
    ],
  },
]
