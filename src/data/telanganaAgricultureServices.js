// Published contacts from Telangana Rythu Bharosa; KVK locations from ICAR.
// Directory records have no coordinates unless supplied by a verified location source.
export const sources = [
  { label: "Telangana Rythu Bharosa District Agriculture Officer directory", url: "https://www.rythubharosa.telangana.gov.in/assets/files/DAO_Mobile%20Numbers.pdf" },
  { label: "ICAR Telangana KVK directory", url: "https://www.icar.gov.in/en/node/15048" },
  { label: "Telangana Agriculture Department laboratory directory", url: "https://agri.telangana.gov.in/open_record.php?ID=68" },
  { label: "Telangana Horticulture Department contacts", url: "https://horticulture.tg.nic.in/Contact.html" },
];

const daoContacts = [
  ["Adilabad", "8977742697"], ["Bhadradri Kothagudem", "8977743066"], ["Hanamkonda", "8977756346"],
  ["Jagtial", "8977745435"], ["Jangaon", "8977745480"], ["Jayashankar Bhupalpally", "8977745518"],
  ["Jogulamba Gadwal", "8977745995"], ["Kamareddy", "8977746046"], ["Karimnagar", "8977746334"],
  ["Khammam", "8977747500"], ["Kumuram Bheem Asifabad", "8977748730"], ["Mahabubabad", "8977749210"],
  ["Mahabubnagar", "8977749229"], ["Mancherial", "8977750735"], ["Medak", "8977750785"],
  ["Medchal-Malkajgiri", "8977751031"], ["Mulugu", "8977751139"], ["Nagarkurnool", "8977751163"],
  ["Nalgonda", "8977751294"], ["Narayanpet", "8977751549"], ["Nirmal", "8977751748"],
  ["Nizamabad", "8977751940"], ["Peddapalli", "8977752780"], ["Rajanna Sircilla", "8977755264"],
  ["Rangareddy", "8977753329"], ["Sangareddy", "8977754689"], ["Siddipet", "8977754775"],
  ["Suryapet", "8977755833"], ["Vikarabad", "8977755890"], ["Wanaparthy", "8977756108"],
  ["Warangal", "8977756214"], ["Yadadri Bhuvanagiri", "8977756419"],
].map(([district, phone]) => ({ id: `dao-${district}`, name: `${district} District Agriculture Officer`, category: "office", kind: "District Agriculture Office", district, locality: "District-level contact; exact office address not listed here", phone, source: sources[0].url }));

const kvkPlaces = [
  ["Adilabad", "Ramnagar"], ["Karimnagar", "Jammikunta"], ["Karimnagar", "Ramagirikhilla, Kamanpur"],
  ["Khammam", "Wyra"], ["Mahabubnagar", "Madanapuram, Kothakota"], ["Mahabubnagar", "Palem"],
  ["Sangareddy", "Didigi, Zaheerabad"], ["Nalgonda", "Gaddipally, Garedepally"],
  ["Nalgonda", "Kampasagar"], ["Nizamabad", "Rudrur"], ["Rangareddy", "Hayathnagar"],
  ["Mahabubabad", "Malyal"], ["Warangal", "Mamnoor"], ["Bhadradri Kothagudem", "Garimellapadu"],
  ["Mancherial", "Budakalan, Bellampally"], ["Medak", "Tuniki, Kowdipally"],
].map(([district, locality], i) => ({ id: `kvk-${i}`, name: "Krishi Vigyan Kendra (KVK)", category: "support", kind: "Farmer training and advisory", district, locality, phone: "", source: sources[1].url }));

const horticultureContacts = [
  ["Adilabad", "8977713928"], ["Asifabad", "8977713963"], ["Bhupalpally", "8977714063"],
  ["Gadwal", "8977714301"], ["Hanamkonda", "8977714059"], ["Jagtial", "8977714045"],
  ["Jangaon", "8977714093"], ["Kamareddy", "8977714025"], ["Karimnagar", "8977714031"],
  ["Khammam", "8977714101"], ["Kothagudem", "8977714117"], ["Mahabubabad", "8977714079"],
  ["Mahabubnagar", "8977714438"], ["Mancherial", "8977713953"], ["Medak", "8977714424"],
  ["Medchal", "8977714250"], ["Mulugu", "8977714418"], ["Nagarkurnool", "8977714458"],
  ["Nalgonda", "8977714152"], ["Narayanpet", "8977714437"], ["Nirmal", "8977713946"],
  ["Nizamabad", "8977713968"], ["Peddapalli", "8977714033"], ["Rangareddy", "8977714217"],
  ["Sangareddy", "8977714260"], ["Siddipet", "8977714425"], ["Siricilla", "8977714051"],
  ["Suryapet", "8977714167"], ["Vikarabad", "8977714194"], ["Wanaparthy", "8977714302"],
  ["Warangal", "8977714055"], ["Yadadri Bhuvanagiri", "8977714190"],
].map(([district, phone]) => ({ id: `horti-${district}`, name: `${district} District Horticulture & Sericulture Officer`, category: "horticulture", kind: "Horticulture office", district, locality: "District contact; see official directory for office address", phone, source: sources[3].url }));

const soilLabs = [
  ["Mahabubnagar", "Jadcherla"], ["Mahabubnagar", "Kollapur"], ["Nalgonda", "Miryalaguda"],
  ["Khammam", "Khammam"], ["Warangal", "Warangal"], ["Karimnagar", "Karimnagar"],
  ["Adilabad", "Adilabad"], ["Nizamabad", "Nizamabad"], ["Sangareddy", "Sangareddy"], ["Rangareddy", "Rangareddy"],
  ["Mahabubnagar", "Narayanpet (AMC)"], ["Mahabubnagar", "Gadwal (AMC)"], ["Mahabubnagar", "Nagarkurnool (AMC)"], ["Mahabubnagar", "Wanaparthy (AMC)"],
  ["Nalgonda", "Nalgonda (AMC)"], ["Nalgonda", "Bhongir (AMC)"], ["Nalgonda", "Suryapet (AMC)"],
  ["Khammam", "Kothagudem (AMC)"], ["Khammam", "Bhadrachalam (AMC)"], ["Khammam", "Sathupally (AMC)"],
  ["Warangal", "Kesamudram (AMC)"], ["Warangal", "Jangaon (AMC)"], ["Warangal", "Eturunagaram (AMC)"],
  ["Karimnagar", "Peddapalli (AMC)"], ["Karimnagar", "Jagtial (AMC)"], ["Karimnagar", "Vemulawada (AMC)"], ["Karimnagar", "Manthani (AMC)"],
  ["Adilabad", "Indervelly (AMC)"], ["Adilabad", "Nirmal (AMC)"], ["Adilabad", "Mancherial (AMC)"],
  ["Nizamabad", "Bodhan (AMC)"], ["Nizamabad", "Kamareddy (AMC)"], ["Medak", "Medak (AMC)"], ["Medak", "Siddipet (AMC)"],
  ["Rangareddy", "Ibrahimpatnam (AMC)"], ["Rangareddy", "Vikarabad (AMC)"], ["Rangareddy", "Pargi (AMC)"], ["Rangareddy", "Medchal (AMC)"],
].map(([district, locality], index) => ({ id: `soil-${index}`, name: "Soil Testing Laboratory", category: "soil", kind: locality.includes("AMC") ? "Agriculture Market Committee soil lab" : "Agriculture Department soil lab", district, locality, phone: "", source: sources[2].url }));

export const telanganaDirectory = [...daoContacts, ...kvkPlaces, ...horticultureContacts, ...soilLabs];
