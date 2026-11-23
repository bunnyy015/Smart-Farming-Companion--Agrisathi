import { ArrowLeft, Leaf, Mail, PackageCheck, ShoppingBasket, Sprout, Store, Wheat } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { getLanguage } from "../../utils/language";
import "./AboutContactPage.css";

const pageCopy = {
  en: {
    back: "Back to role selection", aboutTab: "About Us", contactTab: "Contact Us",
    aboutEyebrow: "SMART FARMING COMPANION", aboutTitle: "A helpful companion for every growing season",
    aboutIntro: "AgriSaathi is a farming companion built around two groups: farmers looking for practical farm information and local supplies, and agricultural dealers serving those farmers. It brings their everyday tools and marketplace interactions together in one place.",
    featuresTitle: "Tools for farmers and agricultural dealers", farmers: "For farmers", farmersText: "Create a farm profile with your location, crops, land, and soil details. Use local weather, photo-based crop health guidance, land and seasonal crop suggestions, government scheme discovery, nearby agricultural services, the farming community, and the voice assistant.",
    farmerMarkets: "Prices, products & orders", farmerMarketsText: "Compare available market price records, browse products listed by local dealers, send order or reservation requests, and follow your order status and history. Product collection and payment arrangements are made with the dealer.",
    dealers: "For agricultural dealers", dealersText: "Maintain a dealer profile, list agricultural products, update prices and stock, review farmer order requests, and follow completed sales and revenue from the dealer portal.",
    dealerWorkflow: "Products, stock & sales", dealerWorkflowText: "Keep product descriptions, prices, and available quantities current. Review and process farmer requests, then keep track of completed sales and revenue.",
    guidance: "Using farmer guidance", guidanceText: "Crop photo analysis and land suggestions are informational aids, not laboratory tests or a substitute for qualified local advice. Scheme matches are not official approval; confirm current eligibility and dates with the scheme authority. Weather, market, and service listings depend on available data.",
    contactEyebrow: "WE’RE HERE TO HELP", contactTitle: "Contact AgriSaathi", contactIntro: "Questions, feedback, or a problem using the app? Email the AgriSaathi team and include the page you were using and a short description so we can understand the issue.",
    email: "Email AgriSaathi", contactAddress: "agrisathi123@gmail.com", privacyNote: "For your safety, do not include your password, one-time codes, or other account secrets in your email.",
    footer: "Better farming, brighter future.",
  },
  te: {
    back: "పాత్ర ఎంపికకు తిరిగి వెళ్ళండి", aboutTab: "మా గురించి", contactTab: "మమ్మల్ని సంప్రదించండి",
    aboutEyebrow: "స్మార్ట్ వ్యవసాయ సహచరి", aboutTitle: "ప్రతి పంట కాలానికి తోడుగా",
    aboutIntro: "AgriSaathi రెండు వర్గాల కోసం రూపొందించిన వ్యవసాయ సహచరి: ఉపయోగకరమైన వ్యవసాయ సమాచారం, స్థానిక సరఫరాలు కోరుకునే రైతులు మరియు వారికి సేవలందించే వ్యవసాయ డీలర్లు. వారి రోజువారీ సాధనాలు, మార్కెట్ పరస్పర చర్యలను ఒకచోట అందిస్తుంది.",
    featuresTitle: "రైతులు, వ్యవసాయ డీలర్ల కోసం సాధనాలు", farmers: "రైతుల కోసం", farmersText: "స్థానం, పంటలు, భూమి, నేల వివరాలతో వ్యవసాయ ప్రొఫైల్ సృష్టించండి. స్థానిక వాతావరణం, ఫోటో ఆధారిత పంట ఆరోగ్య సూచనలు, భూమి మరియు కాలానుగుణ పంట సూచనలు, ప్రభుత్వ పథకాల సమాచారం, సమీప వ్యవసాయ సేవలు, రైతుల సమూహం, వాయిస్ అసిస్టెంట్‌ను ఉపయోగించండి.",
    farmerMarkets: "ధరలు, ఉత్పత్తులు & ఆర్డర్లు", farmerMarketsText: "అందుబాటులో ఉన్న మార్కెట్ ధరలను పోల్చండి, స్థానిక డీలర్ ఉత్పత్తులను చూడండి, ఆర్డర్ లేదా రిజర్వేషన్ అభ్యర్థనలు పంపండి, ఆర్డర్ స్థితి మరియు చరిత్రను అనుసరించండి. ఉత్పత్తి సేకరణ, చెల్లింపుల గురించి డీలర్‌తో మాట్లాడండి.",
    dealers: "వ్యవసాయ డీలర్ల కోసం", dealersText: "డీలర్ ప్రొఫైల్ నిర్వహించండి, ఉత్పత్తులు జాబితా చేయండి, ధరలు మరియు స్టాక్ నవీకరించండి, రైతుల ఆర్డర్లను పరిశీలించండి, అమ్మకాలు మరియు ఆదాయాన్ని చూడండి.",
    dealerWorkflow: "ఉత్పత్తులు, స్టాక్ & అమ్మకాలు", dealerWorkflowText: "ఉత్పత్తి వివరణలు, ధరలు, అందుబాటులో ఉన్న పరిమాణాలను నవీకరించండి. రైతుల అభ్యర్థనలను పరిశీలించి, పూర్తయిన అమ్మకాలు మరియు ఆదాయాన్ని అనుసరించండి.",
    guidance: "రైతు సూచనలను జాగ్రత్తగా వాడండి", guidanceText: "పంట ఫోటో, భూమి సూచనలు సమాచారం కోసం మాత్రమే; ప్రయోగశాల పరీక్షలు లేదా నిపుణుల సలహాకు ప్రత్యామ్నాయం కావు. పథకం సరిపోలిక అధికారిక ఆమోదం కాదు. తాజా అర్హతలు, తేదీలు అధికారిక వనరుల్లో నిర్ధారించండి.",
    contactEyebrow: "మీకు సహాయం చేయడానికి సిద్ధంగా ఉన్నాం", contactTitle: "AgriSaathiని సంప్రదించండి", contactIntro: "ప్రశ్నలు, అభిప్రాయం లేదా యాప్ సమస్య ఉందా? మీరు ఉపయోగించిన పేజీ పేరుతో పాటు సమస్యను వివరించి AgriSaathi బృందానికి ఇమెయిల్ చేయండి.",
    email: "AgriSaathiకి ఇమెయిల్ చేయండి", contactAddress: "agrisathi123@gmail.com", privacyNote: "మీ భద్రత కోసం పాస్‌వర్డ్ లేదా ఒకసారి ఉపయోగించే కోడ్‌లను ఇమెయిల్‌లో పంపవద్దు.", footer: "మెరుగైన వ్యవసాయం, ప్రకాశవంతమైన భవిష్యత్తు.",
  },
  hi: {
    back: "भूमिका चयन पर वापस जाएँ", aboutTab: "हमारे बारे में", contactTab: "संपर्क करें",
    aboutEyebrow: "स्मार्ट खेती साथी", aboutTitle: "हर फसल मौसम का उपयोगी साथी",
    aboutIntro: "AgriSaathi दो समूहों के लिए खेती का साथी है: उपयोगी खेती की जानकारी और स्थानीय सामग्री चाहने वाले किसान, और उनकी सेवा करने वाले कृषि डीलर। यह उनके रोज़मर्रा के टूल और बाज़ार के काम एक जगह लाता है।",
    featuresTitle: "किसानों और कृषि डीलरों के लिए टूल", farmers: "किसानों के लिए", farmersText: "स्थान, फसल, भूमि और मिट्टी की जानकारी वाला प्रोफ़ाइल बनाएँ। स्थानीय मौसम, फोटो-आधारित फसल मार्गदर्शन, भूमि और मौसम के अनुसार फसल सुझाव, सरकारी योजनाएँ, पास की कृषि सेवाएँ, किसान समुदाय और वॉइस असिस्टेंट इस्तेमाल करें।",
    farmerMarkets: "भाव, उत्पाद और ऑर्डर", farmerMarketsText: "उपलब्ध बाज़ार भावों की तुलना करें, स्थानीय डीलर उत्पाद देखें, ऑर्डर या रिज़र्वेशन अनुरोध भेजें और ऑर्डर की स्थिति व इतिहास देखें। उत्पाद लेने और भुगतान की व्यवस्था डीलर से करें।",
    dealers: "कृषि डीलरों के लिए", dealersText: "डीलर प्रोफ़ाइल और उत्पाद सूची संभालें, कीमत और स्टॉक अपडेट करें, किसान ऑर्डर देखें और बिक्री व राजस्व पर नज़र रखें।",
    dealerWorkflow: "उत्पाद, स्टॉक और बिक्री", dealerWorkflowText: "उत्पाद विवरण, कीमत और उपलब्ध मात्रा अपडेट रखें। किसान अनुरोध देखें और संभालें, फिर पूरी हुई बिक्री और राजस्व पर नज़र रखें।",
    guidance: "किसान मार्गदर्शन का उपयोग", guidanceText: "फसल फोटो और भूमि सुझाव जानकारी के लिए हैं, प्रयोगशाला जाँच या विशेषज्ञ सलाह का विकल्प नहीं। योजना मिलान आधिकारिक स्वीकृति नहीं है। पात्रता और तारीखें आधिकारिक स्रोत से जाँचें।",
    contactEyebrow: "हम मदद के लिए यहाँ हैं", contactTitle: "AgriSaathi से संपर्क करें", contactIntro: "सवाल, सुझाव या ऐप में समस्या है? जिस पेज का उपयोग कर रहे थे उसका नाम और समस्या का संक्षिप्त विवरण ईमेल में भेजें।",
    email: "AgriSaathi को ईमेल करें", contactAddress: "agrisathi123@gmail.com", privacyNote: "सुरक्षा के लिए अपना पासवर्ड या वन-टाइम कोड ईमेल में न भेजें।", footer: "बेहतर खेती, उज्ज्वल भविष्य।",
  },
  ta: {
    back: "பாத்திரத் தேர்வுக்குத் திரும்பு", aboutTab: "எங்களைப் பற்றி", contactTab: "தொடர்பு கொள்ளுங்கள்",
    aboutEyebrow: "ஸ்மார்ட் விவசாயத் துணை", aboutTitle: "ஒவ்வொரு பயிர் பருவத்திற்கும் உதவும் துணை",
    aboutIntro: "AgriSaathi இரண்டு குழுக்களுக்கான விவசாயத் துணை: பயனுள்ள விவசாயத் தகவல் மற்றும் உள்ளூர் பொருட்களைத் தேடும் விவசாயிகள், அவர்களுக்குச் சேவை செய்யும் விவசாய விற்பனையாளர்கள். அன்றாடக் கருவிகளையும் சந்தைச் செயல்பாடுகளையும் ஒரே இடத்தில் இணைக்கிறது.",
    featuresTitle: "விவசாயிகள் மற்றும் விவசாய விற்பனையாளர்களுக்கான கருவிகள்", farmers: "விவசாயிகளுக்கு", farmersText: "இடம், பயிர்கள், நிலம் மற்றும் மண் விவரங்களுடன் பண்ணை சுயவிவரம் உருவாக்குங்கள். உள்ளூர் வானிலை, புகைப்பட அடிப்படையிலான பயிர் வழிகாட்டுதல், நிலம் மற்றும் பருவப் பயிர் பரிந்துரைகள், அரசுத் திட்டங்கள், அருகிலுள்ள விவசாயச் சேவைகள், விவசாயச் சமூகம், குரல் உதவியாளர் ஆகியவற்றைப் பயன்படுத்துங்கள்.",
    farmerMarkets: "விலைகள், பொருட்கள் மற்றும் ஆர்டர்கள்", farmerMarketsText: "கிடைக்கும் சந்தை விலைகளை ஒப்பிட்டு, உள்ளூர் விற்பனையாளர் பொருட்களைப் பார்த்து, ஆர்டர் அல்லது முன்பதிவு கோரிக்கைகளை அனுப்பி, ஆர்டர் நிலை மற்றும் வரலாற்றைக் கண்காணிக்கவும். பொருள் பெறுதல் மற்றும் கட்டணத்தை விற்பனையாளருடன் ஏற்பாடு செய்யுங்கள்.",
    dealers: "விவசாய விற்பனையாளர்களுக்கு", dealersText: "விற்பனையாளர் சுயவிவரம், பொருட்கள், விலைகள் மற்றும் இருப்பை நிர்வகித்து, விவசாயி ஆர்டர்கள், விற்பனை மற்றும் வருவாயைக் கண்காணிக்கவும்.",
    dealerWorkflow: "பொருட்கள், இருப்பு மற்றும் விற்பனை", dealerWorkflowText: "பொருள் விவரங்கள், விலைகள் மற்றும் இருப்பைப் புதுப்பிக்கவும். விவசாயி கோரிக்கைகளைக் கையாள்ந்து, முடிந்த விற்பனை மற்றும் வருவாயைக் கண்காணிக்கவும்.",
    guidance: "விவசாயி வழிகாட்டுதலைப் பயன்படுத்துதல்", guidanceText: "பயிர் புகைப்படம் மற்றும் நிலப் பரிந்துரைகள் தகவலுக்கானவை; ஆய்வகச் சோதனை அல்லது நிபுணர் ஆலோசனைக்கு மாற்றாகாது. திட்டப் பொருத்தம் அதிகாரப்பூர்வ ஒப்புதல் அல்ல. தகுதி, தேதிகளை அதிகாரப்பூர்வ ஆதாரத்தில் சரிபார்க்கவும்.",
    contactEyebrow: "உதவ நாங்கள் இருக்கிறோம்", contactTitle: "AgriSaathi-ஐத் தொடர்பு கொள்ளுங்கள்", contactIntro: "கேள்வி, கருத்து அல்லது செயலியில் சிக்கலா? பயன்படுத்திய பக்கத்தின் பெயரையும் சிக்கலின் சுருக்கத்தையும் மின்னஞ்சலில் அனுப்புங்கள்.",
    email: "AgriSaathi-க்கு மின்னஞ்சல்", contactAddress: "agrisathi123@gmail.com", privacyNote: "பாதுகாப்பிற்காக உங்கள் கடவுச்சொல் அல்லது ஒருமுறை குறியீட்டை மின்னஞ்சலில் அனுப்ப வேண்டாம்.", footer: "சிறந்த விவசாயம், ஒளிமயமான எதிர்காலம்.",
  },
  kn: {
    back: "ಪಾತ್ರ ಆಯ್ಕೆಗೆ ಹಿಂತಿರುಗಿ", aboutTab: "ನಮ್ಮ ಬಗ್ಗೆ", contactTab: "ನಮ್ಮನ್ನು ಸಂಪರ್ಕಿಸಿ",
    aboutEyebrow: "ಸ್ಮಾರ್ಟ್ ಕೃಷಿ ಸಂಗಾತಿ", aboutTitle: "ಪ್ರತಿ ಬೆಳೆಯ ಋತುವಿಗೂ ನೆರವಾಗುವ ಸಂಗಾತಿ",
    aboutIntro: "AgriSaathi ಎರಡು ಗುಂಪುಗಳಿಗಾಗಿ ನಿರ್ಮಿಸಿದ ಕೃಷಿ ಸಂಗಾತಿ: ಉಪಯುಕ್ತ ಕೃಷಿ ಮಾಹಿತಿ ಮತ್ತು ಸ್ಥಳೀಯ ಸಾಮಗ್ರಿ ಹುಡುಕುವ ರೈತರು, ಅವರಿಗೆ ಸೇವೆ ನೀಡುವ ಕೃಷಿ ಡೀಲರ್‌ಗಳು. ಅವರ ದೈನಂದಿನ ಸಾಧನಗಳು ಮತ್ತು ಮಾರುಕಟ್ಟೆ ಸಂವಹನವನ್ನು ಒಂದೇ ಸ್ಥಳದಲ್ಲಿ ತರುತ್ತದೆ.",
    featuresTitle: "ರೈತರು ಮತ್ತು ಕೃಷಿ ಡೀಲರ್‌ಗಳಿಗಾಗಿ ಸಾಧನಗಳು", farmers: "ರೈತರಿಗಾಗಿ", farmersText: "ಸ್ಥಳ, ಬೆಳೆ, ಭೂಮಿ ಮತ್ತು ಮಣ್ಣಿನ ವಿವರಗಳೊಂದಿಗೆ ಕೃಷಿ ಪ್ರೊಫೈಲ್ ರಚಿಸಿ. ಸ್ಥಳೀಯ ಹವಾಮಾನ, ಫೋಟೋ ಆಧಾರಿತ ಬೆಳೆ ಮಾರ್ಗದರ್ಶನ, ಭೂಮಿ ಮತ್ತು ಋತುಮಾನ ಬೆಳೆ ಸಲಹೆಗಳು, ಸರ್ಕಾರಿ ಯೋಜನೆಗಳು, ಹತ್ತಿರದ ಕೃಷಿ ಸೇವೆಗಳು, ಕೃಷಿ ಸಮುದಾಯ ಮತ್ತು ಧ್ವನಿ ಸಹಾಯಕವನ್ನು ಬಳಸಿ.",
    farmerMarkets: "ಬೆಲೆ, ಉತ್ಪನ್ನ ಮತ್ತು ಆರ್ಡರ್‌ಗಳು", farmerMarketsText: "ಲಭ್ಯವಿರುವ ಮಾರುಕಟ್ಟೆ ಬೆಲೆಗಳನ್ನು ಹೋಲಿಸಿ, ಸ್ಥಳೀಯ ಡೀಲರ್ ಉತ್ಪನ್ನಗಳನ್ನು ನೋಡಿ, ಆರ್ಡರ್ ಅಥವಾ ಕಾಯ್ದಿರಿಸುವ ವಿನಂತಿ ಕಳುಹಿಸಿ ಮತ್ತು ಆರ್ಡರ್ ಸ್ಥಿತಿ ಹಾಗೂ ಇತಿಹಾಸ ಪರಿಶೀಲಿಸಿ. ಉತ್ಪನ್ನ ಪಡೆಯುವುದು ಮತ್ತು ಪಾವತಿಯನ್ನು ಡೀಲರ್ ಜೊತೆ ವ್ಯವಸ್ಥೆಮಾಡಿ.",
    dealers: "ಕೃಷಿ ಡೀಲರ್‌ಗಳಿಗಾಗಿ", dealersText: "ಡೀಲರ್ ಪ್ರೊಫೈಲ್, ಉತ್ಪನ್ನ ಪಟ್ಟಿ, ಬೆಲೆ ಮತ್ತು ಸ್ಟಾಕ್ ನಿರ್ವಹಿಸಿ; ರೈತರ ಆರ್ಡರ್‌ಗಳು, ಮಾರಾಟ ಮತ್ತು ಆದಾಯ ಪರಿಶೀಲಿಸಿ.",
    dealerWorkflow: "ಉತ್ಪನ್ನ, ಸ್ಟಾಕ್ ಮತ್ತು ಮಾರಾಟ", dealerWorkflowText: "ಉತ್ಪನ್ನ ವಿವರಣೆ, ಬೆಲೆ ಮತ್ತು ಲಭ್ಯ ಪ್ರಮಾಣವನ್ನು ನವೀಕರಿಸಿ. ರೈತರ ವಿನಂತಿಗಳನ್ನು ಪರಿಶೀಲಿಸಿ ಮತ್ತು ಪೂರ್ಣಗೊಂಡ ಮಾರಾಟ ಹಾಗೂ ಆದಾಯ ಗಮನಿಸಿ.",
    guidance: "ರೈತ ಮಾರ್ಗದರ್ಶನವನ್ನು ಜವಾಬ್ದಾರಿಯಿಂದ ಬಳಸಿ", guidanceText: "ಬೆಳೆ ಫೋಟೋ ಮತ್ತು ಭೂಮಿ ಸಲಹೆಗಳು ಮಾಹಿತಿ ಉದ್ದೇಶಕ್ಕೆ ಮಾತ್ರ; ಪ್ರಯೋಗಾಲಯ ಪರೀಕ್ಷೆ ಅಥವಾ ತಜ್ಞರ ಸಲಹೆಗೆ ಬದಲಿಯಾಗಿಲ್ಲ. ಯೋಜನೆ ಹೊಂದಾಣಿಕೆ ಅಧಿಕೃತ ಅನುಮೋದನೆ ಅಲ್ಲ. ಅರ್ಹತೆ ಮತ್ತು ದಿನಾಂಕಗಳನ್ನು ಅಧಿಕೃತ ಮೂಲದಲ್ಲಿ ಪರಿಶೀಲಿಸಿ.",
    contactEyebrow: "ಸಹಾಯ ಮಾಡಲು ನಾವು ಇಲ್ಲಿದ್ದೇವೆ", contactTitle: "AgriSaathi ಅನ್ನು ಸಂಪರ್ಕಿಸಿ", contactIntro: "ಪ್ರಶ್ನೆ, ಪ್ರತಿಕ್ರಿಯೆ ಅಥವಾ ಆ್ಯಪ್ ಸಮಸ್ಯೆಯಿದೆಯೇ? ನೀವು ಬಳಸುತ್ತಿದ್ದ ಪುಟ ಮತ್ತು ಸಮಸ್ಯೆಯ ಸಂಕ್ಷಿಪ್ತ ವಿವರಣೆಯನ್ನು ಇಮೇಲ್ ಮಾಡಿ.",
    email: "AgriSaathi ಗೆ ಇಮೇಲ್ ಮಾಡಿ", contactAddress: "agrisathi123@gmail.com", privacyNote: "ಸುರಕ್ಷತೆಗಾಗಿ ನಿಮ್ಮ ಪಾಸ್‌ವರ್ಡ್ ಅಥವಾ ಒನ್-ಟೈಮ್ ಕೋಡ್ ಅನ್ನು ಇಮೇಲ್‌ನಲ್ಲಿ ಕಳುಹಿಸಬೇಡಿ.", footer: "ಉತ್ತಮ ಕೃಷಿ, ಉಜ್ವಲ ಭವಿಷ್ಯ.",
  },
};

const featureCards = [
  { icon: Wheat, title: "farmers", text: "farmersText" },
  { icon: ShoppingBasket, title: "farmerMarkets", text: "farmerMarketsText" },
  { icon: Store, title: "dealers", text: "dealersText" },
  { icon: PackageCheck, title: "dealerWorkflow", text: "dealerWorkflowText" },
];

export default function AboutContactPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeSection = searchParams.get("section") === "contact" ? "contact" : "about";
  const language = getLanguage();
  const copy = pageCopy[language] || pageCopy.en;
  const supportEmail = "agrisathi123@gmail.com";

  function selectSection(section) {
    setSearchParams({ section });
  }

  return (
    <div className="about-contact-page">
      <header className="about-contact-topbar">
        <button className="about-contact-brand" type="button" onClick={() => navigate("/role-selection")} aria-label="AgriSaathi home">
          <span className="about-contact-brand-mark"><Sprout size={23} /></span>
          <span>AgriSaathi</span>
        </button>
        <button className="about-contact-back" type="button" onClick={() => navigate("/role-selection")} aria-label={copy.back}>
          <ArrowLeft size={17} /> <span>{copy.back}</span>
        </button>
      </header>

      <main className="about-contact-main">
        <div className="about-contact-heading">
          <span className="about-contact-eyebrow"><Leaf size={15} /> {activeSection === "about" ? copy.aboutEyebrow : copy.contactEyebrow}</span>
          <h1>{activeSection === "about" ? copy.aboutTitle : copy.contactTitle}</h1>
        </div>

        <nav className="about-contact-tabs" aria-label="About and contact sections">
          <button type="button" className={activeSection === "about" ? "is-active" : ""} aria-current={activeSection === "about" ? "page" : undefined} onClick={() => selectSection("about")}>
            {copy.aboutTab}
          </button>
          <button type="button" className={activeSection === "contact" ? "is-active" : ""} aria-current={activeSection === "contact" ? "page" : undefined} onClick={() => selectSection("contact")}>
            {copy.contactTab}
          </button>
        </nav>

        {activeSection === "about" ? (
          <section className="about-contact-content" aria-labelledby="about-contact-section-title">
            <div className="about-contact-intro">
              <span className="about-contact-orbit" aria-hidden="true">🌱</span>
              <div>
                <h2 id="about-contact-section-title">{copy.featuresTitle}</h2>
                <p>{copy.aboutIntro}</p>
              </div>
            </div>
            <div className="about-contact-feature-grid">
              {featureCards.map(({ icon: Icon, title, text }) => (
                <article className="about-contact-feature" key={title}>
                  <span className="about-contact-feature-icon"><Icon size={20} /></span>
                  <div>
                    <h3>{copy[title]}</h3>
                    <p>{copy[text]}</p>
                  </div>
                </article>
              ))}
            </div>
          </section>
        ) : (
          <section className="about-contact-content about-contact-help" aria-labelledby="about-contact-section-title">
            <span className="about-contact-help-icon"><Mail size={26} /></span>
            <h2 id="about-contact-section-title">{copy.contactTitle}</h2>
            <p>{copy.contactIntro}</p>
            <div className="about-contact-methods">
              <a href={`mailto:${supportEmail}`}><Mail size={18} /><span><small>{copy.email}</small>{supportEmail}</span></a>
            </div>
            <p className="about-contact-privacy">{copy.privacyNote}</p>
          </section>
        )}
      </main>

      <footer className="about-contact-footer"><Sprout size={16} /> {copy.footer}</footer>
    </div>
  );
}
