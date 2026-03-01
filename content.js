
// ═════════════════════════════════════════════════════════════════════════════
// USER-PROVIDED PATTERNS
// ═════════════════════════════════════════════════════════════════════════════
// XPaths updated to match Facebook DOM as of 2026-03-01.
// Primary detection is aria-role based; these are fallbacks only.
const MOST_RELEVANT_XPATH = '/html/body/div[1]/div/div[1]/div/div[4]/div/div/div[1]/div/div[2]/div/div/div/div/div/div/div/div[2]/div[2]/div/div/div[2]/div/div[2]/div[1]/div/div/span';
// Points to the dropdown CONTAINER div; sortToAllComments() searches inside it for the menuitem.
const ALL_COMMENTS_XPATH  = '/html/body/div[1]/div/div[1]/div/div[4]/div/div/div[1]/div/div[3]/div/div[1]/div[1]/div[1]/div/div/div/div/div/div/div[1]/div/div[3]';
// Two comment-button layouts observed in the wild (div[3] vs div[4] in the path):
// Layout A — feed / group posts
const COMMENTS_BTN_XPATH  = '/html/body/div[1]/div/div[1]/div/div[3]/div/div/div[1]/div[1]/div/div[2]/div/div/div/div[2]/div/div[4]/div/div[2]/div[1]/div/span/div/div/div/div/div/div/div/div/div/div/div/div/div[13]/div/div/div[4]/div/div/div/div/div[1]/div/div[2]/div[2]/span/div/span/span';
// Layout B — video / photo / permalink posts
const COMMENTS_BTN_XPATH_2 = '/html/body/div[1]/div/div[1]/div/div[4]/div/div/div[1]/div/div[2]/div/div/div/div/div/div/div/div[2]/div[2]/div/div/div[2]/div/div[1]/div/div[1]/div/div[2]/div[2]/span/div/span/span';

// ═════════════════════════════════════════════════════════════════════════════
// GLOBAL STATE
// ═════════════════════════════════════════════════════════════════════════════
let _paused           = false;
let _stopped          = false;
let _badge            = null;
let _pauseBtn         = null;
let _translateEnabled = true;
let _scrollArea       = null;   // cached scroll container — reset each scrape run

// ═════════════════════════════════════════════════════════════════════════════
// SLEEP  (pause-aware + stop-aware)
// ═════════════════════════════════════════════════════════════════════════════
async function sleep(ms) {
    const TICK = 100;
    let elapsed = 0;
    while (elapsed < ms || _paused) {
        if (_stopped) return;
        await new Promise(r => setTimeout(r, TICK));
        if (!_paused) elapsed += TICK;
    }
}

// ═════════════════════════════════════════════════════════════════════════════
// STATUS BADGE
// ═════════════════════════════════════════════════════════════════════════════
function showStatus(msg, color = '#1877f2') {
    if (!_badge) {
        _badge = document.createElement('div');
        Object.assign(_badge.style, {
            position: 'fixed', top: '16px', right: '16px', zIndex: '2147483647',
            padding: '14px 16px', borderRadius: '12px', fontSize: '13px',
            fontWeight: 'bold', color: '#fff',
            boxShadow: '0 4px 20px rgba(0,0,0,0.45)',
            maxWidth: '300px', fontFamily: 'Arial, sans-serif',
        });
        const txt = document.createElement('div');
        txt.id = '_fb_s_txt';
        Object.assign(txt.style, { marginBottom: '10px', lineHeight: '1.5', whiteSpace: 'pre-wrap' });
        _badge.appendChild(txt);
        const row = document.createElement('div');
        Object.assign(row.style, { display: 'flex', gap: '8px' });
        _pauseBtn = document.createElement('button');
        Object.assign(_pauseBtn.style, {
            flex: '1', padding: '6px 0', border: 'none', borderRadius: '6px',
            cursor: 'pointer', fontWeight: 'bold', fontSize: '12px',
            background: 'rgba(255,255,255,0.28)', color: '#fff',
        });
        _pauseBtn.textContent = 'Pause';
        _pauseBtn.onclick = () => {
            _paused = !_paused;
            _pauseBtn.textContent = _paused ? 'Resume' : 'Pause';
            _pauseBtn.style.background = _paused
                ? 'rgba(255,200,0,0.55)' : 'rgba(255,255,255,0.28)';
        };
        const stopBtn = document.createElement('button');
        Object.assign(stopBtn.style, {
            flex: '1', padding: '6px 0', border: 'none', borderRadius: '6px',
            cursor: 'pointer', fontWeight: 'bold', fontSize: '12px',
            background: 'rgba(220,50,50,0.65)', color: '#fff',
        });
        stopBtn.textContent = 'Stop';
        stopBtn.onclick = () => { _stopped = true; _paused = false; hideStatus(); };
        row.appendChild(_pauseBtn);
        row.appendChild(stopBtn);
        _badge.appendChild(row);
        document.body.appendChild(_badge);
    }
    _badge.style.background = color;
    const t = document.getElementById('_fb_s_txt');
    if (t) t.textContent = msg;
}

function hideStatus() {
    if (_badge) { _badge.remove(); _badge = null; _pauseBtn = null; }
}

// ═════════════════════════════════════════════════════════════════════════════
// SENTIMENT LEXICON  (English + Bangla + Romanised)
// ═════════════════════════════════════════════════════════════════════════════
const POSITIVE_WORDS = [
    // ── English ───────────────────────────────────────────────────────────────
    'good','great','excellent','amazing','wonderful','fantastic','love','like','beautiful',
    'awesome','perfect','best','happy','joy','nice','thank','thanks','brilliant','superb',
    'outstanding','impressive','helpful','kind','lovely','magnificent','marvelous','pleasant',
    'success','win','congratulations','congrats','bravo','support','proud','inspire',
    'appreciate','grateful','blessing','blessed','hope','achieve','strong','brave',
    'smart','wise','talented','skilled','expert','creative','innovative','well done','respect',
    'cheerful','delightful','enjoy','fabulous','friendly','fun','genuine','glad','glorious',
    'gracious','heartfelt','honest','joyful','jubilant','legendary','lively','loyal',
    'mindful','noble','optimistic','passionate','peaceful','positive','powerful','radiant',
    'refreshing','remarkable','resilient','rewarding','satisfying','sincere','spectacular',
    'splendid','stellar','stunning','terrific','thankful','thoughtful','thrilling','tremendous',
    'trustworthy','unique','uplifting','vibrant','victorious','virtuous','wholesome','worthy',
    'wow','yay','top','superb','flawless','breathtaking','enchanting','energetic','flourish',
    'gifted','harmless','ideal','inspired','joyous','keen','luminous','motivated','nurture',
    'peaceful','prosperous','pure','quality','serene','spirited','upbeat','warm',
    'welcoming','winning','witty','zealous','accomplished','adorable','affectionate','agile',
    'alert','alive','astute','attractive','balanced','best wishes','bold','calm','capable',
    'caring','charming','clean','clever','committed','compassionate','competent','confident',
    'cool','courageous','dedicated','determined','dynamic','elegant','empathetic','empowering',
    'encouraging','enthusiastic','faithful','fearless','focused','free','fulfilling','generous',
    'genius','genuine','growth','guidance','halal','healing','heroic','high','honorable',
    // ── English (extended) ────────────────────────────────────────────────────
    'haha','hahaha','lol','lmao','rofl','cute','sweet','pretty','gorgeous','handsome',
    'beautiful mind','so good','very good','so nice','so beautiful','so cute','so sweet',
    'love it','loved it','love this','loved this','love you','love u','i love',
    'well said','very true','absolutely','totally agree','i agree','agreed','exactly right',
    'spot on','so true','true that','facts','period','preach','100%','correct',
    'keep it up','keep going','go on','carry on','never give up','stay strong','stay blessed',
    'all the best','good luck','best of luck','prayers','pray for you','god bless',
    'bless you','more power','you can do it','believe in you','so inspiring',
    'heart touching','mind blowing','jaw dropping','eye opening','life changing',
    'so helpful','very helpful','so useful','very useful','informative','educational',
    'nice work','great work','good work','fine work','excellent work','amazing work',
    'wonderful work','fantastic work','beautiful work','keep up the good work',
    'nice one','good one','great one','this is good','this is great','this is amazing',
    'truly amazing','truly wonderful','truly great','truly inspiring','truly beautiful',
    'highly recommend','must watch','must read','must see','worth it','worth watching',
    'legend','iconic','goat','champion','hero','warrior','winner','superstar','star',
    'fire','lit','dope','slay','slaying','killing it','nailed it','crushed it',
    'blessed day','happy day','good day','great day','wonderful day','beautiful day',
    'masha allah','alhamdulillah','subhanallah','jazakallah','inshallah','ameen','amen',
    'god is good','faith','divine','heavenly','grace','mercy','kindness','peace be upon',
    'solidarity','unity','together','strength','rise','overcome','prevail',
    'deserve','worthy of','honor','tribute','salute','kudos','hats off',
    'impressive work','classy','sophisticated','mature','professional','responsible',
    'fair','just','righteous','moral','ethical','principled','genuine person',
    'real one','authentic','original','natural','down to earth','humble','modest',
    'happy for you','proud of you','so proud','very proud','makes me happy','love seeing this',
    'this made my day','made me smile','smile','smiling','tears of joy','touched my heart',
    'moved me','feeling good','good vibes','positive vibes','vibes','energy',
    // ── Romanised Bangla ─────────────────────────────────────────────────────
    'valo','bhalo','sundor','oshadharon','darun','khub valo','dhonnobad','mashallah',
    'alhamdulillah','masha allah','subhanallah','jajakallah','mojar','shandhar','osthir','fatafati',
    'onek valo','eto sundor','ki sundor','khub sundor','ki darun','ki osodharon',
    'bhalo laglo','onek bhalo laglo','boro valo laglo','sotti sundor','ekdom valo',
    'ekdom sothik','joss','bhalo kaj','maja ache','moja','durun','boro valo',
    'onek khusi','khusi','notun din','valo theko','allah bless','boro bhai valo',
    'osadharon kaj','ki sundar','amazing ache','superb ache','bhai darun','apu darun',
    'khub moja','onek moja','boro sundor','ekta katha valo','salam valo',
    'shadhu','sotti bhalo','onek onek valo','ami proud','notun asha','asha ache',
    'valo manush','boro hridoy','bishwas','shadhona','unnoti','bijoy',
    // ── Romanised Bangla (extended) ───────────────────────────────────────────
    'valo lage','bhalo lage','valo lagche','bhalo lagche','valo laglo','bhalo laglo',
    'sundor laglo','darun laglo','oshadharon laglo','ki je sundor','ato sundor','eto valo',
    'mon vora gelo','mon vore gelo','mon bhore gelo','khub valo laglo','onek valo laglo',
    'dua kori','doa kori','allah rakho','allah hafez','allah hafeez','allah bless koro',
    'shuvo','subho','mubarok','mubarak','eid mubarak','happy birthday','birthday mubarak',
    'congratulations bhai','congratulations apu','congrats bhai','congrats apu',
    'ki sundor bhai','bhai love','apu love','apu sundor','bhai oshadharon',
    'pagol hoye gelam','pagol hoe gelam','pagol hoya gelam','haiya gelam','haira gelam',
    'mon khushi','mon vore gelo','ananda','anondo','khub anondo','onek anondo',
    'boro asha','onek asha','valo thakbe','valo thakun','shusto thakun','sustha thakun',
    'allah apnar bhalo koruk','allah tomar bhalo koruk','dua rakhben','doa rakhben',
    'onek onek shuvo kamona','shuvo kamona','shuvokamona','onek shuvo kamona',
    'mon chhuye gelo','mon chhuiye gelo','onuvuti','anuvooti','hridoy sparsha',
    'sotti bolchi','sotti kotha','ekdom sotti','satyi','sotti satyi','satty kotha',
    'bah','wah','koto sundor','koto valo','koto darun','ki osaddharaon',
    'boro valo laglo','onek valo laglo','khub sundor laglo','darun lagche',
    'amar priyo','priyo manush','priyo bhai','priyo apu','priyo bondhu',
    'respect kori','onek respect','boro respect','salute kori','hat khula salaam',
    'beshi valo','khub beshi valo','onek beshi valo','ato valo','eto darun',
    'joss ache','joss acho','darun ache','oshadharon ache','fatafati ache',
    'notun kichhu','notun kichu','notun kora','notun shuru','noya jibon',
    'valo beshi','valobashi','bhalobashi','valobasi','bhalobasi','valobasa','bhalobasa',
    'sundor hoyeche','darun hoyeche','valo hoyeche','oshadharon hoyeche','fatafati hoyeche',
    'aro chai','aro den','aro dekhte chai','aro shunbo','aro porbo',
    'koto valo manush','koto boro hridoy','koto sohoj','koto shorol',
    'khushir kotha','anonder kotha','valobasar kotha','priyer kotha',
    'allah apnake valo rakhuk','alla tader valo rakhuk','khoda hafez',
    'ki obbhut','obbhut sundor','ajob sundor','ajob darun','ajob valo',
    'moner moto','moner kotha','mone dhoreche','mone chuye geche','mone porbe',
    'jibon sundor','jibon darun','jibon valo','sundar jibon','darun jibon',
    // ── Bangla ───────────────────────────────────────────────────────────────
    'ভালো','সুন্দর','দারুণ','অসাধারণ','ধন্যবাদ','ভালোবাসি','মাশাল্লাহ','আলহামদুলিল্লাহ',
    'শুকরিয়া','অনেক ভালো','খুব ভালো','চমৎকার','অপূর্ব','প্রেম','শুভেচ্ছা',
    'অভিনন্দন','সাহসী','বিজয়','সফলতা','আনন্দ','খুশি','ভালোবাসা','সম্মান',
    'গর্ব','আশীর্বাদ','কৃতজ্ঞ','উৎসাহ','প্রেরণা','বিশ্বাস','শান্তি','সুখী',
    'মনোরম','প্রিয়','ভালো লাগলো','অনেক ভালো লাগলো','চমৎকার কাজ','অপূর্ব সুন্দর',
    'সত্যি সুন্দর','দুর্দান্ত','অনন্য','উপকারী','অনেক মজা','পছন্দ হয়েছে',
    'সেরা','ভালোই হয়েছে','একদম সঠিক','বেস্ট','জটিল','মাসা আল্লাহ',
    'সুন্দর মন','ভালো মানুষ','সত্যিই সুন্দর','অনেক সুন্দর','খুব সুন্দর',
    'একদম ভালো','এত সুন্দর','অনেক খুশি','খুব খুশি','আশা করি','ভালো থাকো',
    'সুস্থ থাকো','দোয়া রইলো','অনেক ধন্যবাদ','ভালো কাজ','অসাধারণ কাজ',
    'চমৎকার লাগলো','দারুণ হয়েছে','খুব ভালো হয়েছে','সত্যিকারের ভালো',
    'মনে ধরেছে','পছন্দ','ভীষণ ভালো','অনেক প্রিয়','হৃদয় স্পর্শ করলো',
    'অনুপ্রাণিত','উদ্বুদ্ধ','শ্রেষ্ঠ','উত্তম','মঙ্গল','আলো','শক্তি','সাফল্য',
    // ── Bangla (extended) ─────────────────────────────────────────────────────
    'ভালো লাগছে','ভালো লেগেছে','ভালো লাগে','খুব ভালো লাগছে','অনেক ভালো লাগছে',
    'সুন্দর লাগছে','দারুণ লাগছে','অসাধারণ লাগছে','চমৎকার লাগছে','অপূর্ব লাগছে',
    'মন ভরে গেলো','মন ভরে গেছে','মন খুশি হলো','মন আনন্দিত','অনেক খুশি লাগছে',
    'বাহ','আহা','বাহ বাহ','আহা হা','কী সুন্দর','কত সুন্দর','কী দারুণ','কত দারুণ',
    'কী অসাধারণ','কত অসাধারণ','কী চমৎকার','কত চমৎকার','কী অপূর্ব',
    'শুভ','শুভকামনা','শুভ হোক','শুভ থাকুন','শুভ থাকো','আল্লাহ ভালো রাখুক',
    'আল্লাহ রক্ষা করুক','আল্লাহ হেফাজত করুক','দোয়া করি','দোয়া রইল',
    'ইনশাআল্লাহ','মাশাআল্লাহ','সুবহানাল্লাহ','আলহামদুলিল্লাহ','জাজাকাল্লাহ',
    'আমিন','ঈদ মুবারক','মোবারকবাদ','অভিনন্দন জানাই','শুভেচ্ছা জানাই',
    'সালাম','সালাম জানাই','আদর','ভালোবাসা রইল','ভালোবাসা দিয়ে','হৃদয়ের শুভেচ্ছা',
    'মুগ্ধ হলাম','মুগ্ধ হয়ে গেলাম','অভিভূত হলাম','অভিভূত','আপ্লুত','আপ্লুত হলাম',
    'হৃদয় ছুঁয়ে গেলো','হৃদয় ছুঁয়ে গেছে','মন ছুঁয়ে গেলো','প্রাণ ছুঁয়ে গেলো',
    'একমত','সহমত','একদম সঠিক','সত্য কথা','একদম মনের কথা','মনের কথা বললেন',
    'সঠিক বলেছেন','ঠিক বলেছেন','ঠিক আছে','একেবারে ঠিক','পুরোপুরি সঠিক',
    'গর্বিত','অনেক গর্বিত','খুব গর্বিত','গর্ব হচ্ছে','গর্ব লাগছে','আমি গর্বিত',
    'অনুপ্রেরণা','প্রেরণাদায়ক','উৎসাহিত','উৎসাহজনক','মনোবল','সাহস','সাহসী কাজ',
    'চমৎকার লেখা','অসাধারণ লেখা','দারুণ লেখা','সুন্দর লেখা','অপূর্ব লেখা',
    'জীবন সুন্দর','জীবন দারুণ','জীবন ভালো','সুন্দর জীবন','আনন্দময় জীবন',
    'ভালো মানুষ','সুন্দর মন','ভালো হৃদয়','বড় হৃদয়','উদার','উদার মন',
    'পরোপকারী','দয়ালু','সহানুভূতিশীল','মানবিক','মানবতাবাদী','মানবতা',
    'আশা আছে','আশার আলো','নতুন আশা','নতুন দিন','নতুন সূচনা','নতুন যাত্রা',
    'ভালোবাসি','ভালোই বাসি','অনেক ভালোবাসি','খুব ভালোবাসি','ভালোবাসা দিয়ে',
    'পছন্দ করি','অনেক পছন্দ','খুব পছন্দ','একদম পছন্দ','মনে পছন্দ',
    'অসম্ভব ভালো','অকল্পনীয়','অবিশ্বাস্য সুন্দর','অতুলনীয়','তুলনাহীন',
    'সেরাদের সেরা','সর্বশ্রেষ্ঠ','অনন্যসাধারণ','অনবদ্য','নিখুঁত',
    'হাজার হাজার ধন্যবাদ','লক্ষ ধন্যবাদ','অসংখ্য ধন্যবাদ','আন্তরিক ধন্যবাদ',
];
const NEGATIVE_WORDS = [
    // ── English ───────────────────────────────────────────────────────────────
    'bad','terrible','awful','horrible','hate','dislike','ugly','worst','poor','sad',
    'angry','wrong','false','lie','liar','fake','fraud','scam','cheat','disgusting',
    'stupid','idiot','fool','dumb','useless','pathetic','shameful','shame','disgrace',
    'boring','waste','spam','annoying','irritating','toxic','disappointed','criminal',
    'abuse','abusive','aggressive','arrogant','attack','betrayal','bitter','blame',
    'brutal','bully','corrupt','coward','cruel','danger','dangerous','deceive','deceiving',
    'depressed','depression','destroy','dirty','dishonest','evil','failure','fear',
    'filthy','garbage','greedy','gross','guilty','harmful','hopeless','humiliate',
    'hypocrite','ignorant','immoral','incompetent','inferior','insult','jealous','lazy',
    'manipulative','mean','miserable','mislead','mock','nasty','negative','neglect',
    'offensive','outrage','pitiful','racist','rude','ruthless','selfish','sinister',
    'suck','threatening','trash','unfair','untrustworthy','vile','violent','vulgar',
    'weak','worthless','wicked','witch','witch hunt','loser','loathe','lame',
    'curse','cursed','creep','crook','con','coerce','chaos','careless','broken',
    'abhorrent','abnormal','appalling','atrocious','betrayed','biased','bigot',
    'blackmail','brainwash','chaotic','cheated','childish','clueless','cold','condemn',
    'conflict','confrontation','creepy','cynical','dark','dead','deceitful',
    'defame','demeaning','demon','deny','deprive','detest','devious','disaster','disgust',
    'disrespect','disrupt','distort','disturbing','dominate','dread','dull','dupe',
    'enrage','exploit','extort','extreme','fanatic','flawed','foolish','force',
    'frustrate','furious','gang','greed','grim','grudge','hardship','harsh','hatred',
    'heartless','hostile','hurt','hypocritical','injustice','irresponsible','irrational',
    'murder','kill','killing','killed','hang','hanging','hanged','execute','execution',
    'malpractice','negligence','incompetence','misconduct','punish','punishment',
    // ── English (extended) ────────────────────────────────────────────────────
    'damn','hell','crap','jerk','moron','imbecile','clown','joke','nonsense','rubbish',
    'ridiculous','absurd','outrageous','scandalous','unacceptable','intolerable','unbearable',
    'shameless','corrupt leader','autocrat','dictator','fascist','oppressor','oppression',
    'terrorist','traitor','backstabber','thief','robber','rapist','criminal act',
    'liar liar','stop lying','stop cheating','propaganda','brainwashed','brainwashing',
    'how dare','how dare you','how dare they','shame on you','shame on them','shame on him','shame on her',
    'cannot believe','cant believe','i cant believe','unbelievable','unacceptable behavior',
    'disgusted','sickened','revolted','repulsed','revolting','repulsive',
    'not okay','not ok','this is wrong','this is bad','this is terrible','this is horrible',
    'so wrong','very wrong','completely wrong','totally wrong','absolutely wrong',
    'so bad','very bad','really bad','extremely bad','incredibly bad','terribly bad',
    'i hate','i hate this','i hate them','i hate it','hate this','hate it','hate them',
    'i dislike','dislike this','not good','no good','not right','not fair','unfair treatment',
    'worst ever','absolute worst','the worst','never seen worse','never been worse',
    'stop this','stop now','must stop','needs to stop','has to stop','should stop',
    'arrest','arrested','jail','prison','locked up','behind bars','accountability',
    'demand justice','justice for','punish them','punish him','punish her','punish this',
    'protest','protesting','boycott','boycotting','reject','rejected','opposition',
    'condemn','condemnation','denounce','denouncing','criticize','criticism','critique',
    'problem','problems','issue','issues','crisis','catastrophe','disaster','mess',
    'failed','failing','has failed','is failing','massive failure','epic fail','total failure',
    'disappointed','deeply disappointed','very disappointed','so disappointed',
    'frustrated','very frustrated','so frustrated','angry','very angry','enraged',
    'depressing','very depressing','so depressing','heartbreaking','heart breaking',
    'this hurts','it hurts','pain','painful','agony','suffering','anguish',
    'victim','victims','oppressed','silenced','censored','suppressed',
    // ── Romanised Bangla ─────────────────────────────────────────────────────
    'kharap','bekar','baje','jhut','mithha','faltu','ganda','ghrina','nafrat','pagol',
    'besharmo','bevakuf','chor','dhoka','harami','kutta','moron','noshto','pakna',
    'shala','shob jhut','thug','besharam','oshhosto','manushna','dhokha deyar',
    'kharap manush','boro bad','onek kharap','ki kharap','ei bad','sobai bad',
    'khub kharap','etota kharap','nishthur','protarok','durnoiti','oporadhi',
    'noshto manush','jhuter dal','kharap kaj','pagla','oshhosto manush',
    'dushto','alosh','okorma','beyadob','ohongkari','sharthopor','kapurush',
    'bhondo','mithhuker dal','birokkhito','onek khrap','faltu manush',
    'fasi','phansi','hatya','maro','mar ','maralo','marilay','batpar','bichar chai',
    'dhik','dhikkhar','pocha','dhongso','moruk','bogar','shalar','sala manush',
    'rajakar','dalal','shuyor','pa chata','mob','dajjal','khankir pola','heda','heda manush',
    // ── Romanised Bangla (extended) ───────────────────────────────────────────
    'ghrina kori','onek ghrina','ghrina lagche','khub ghrina','boro ghrina',
    'lojja lagche','ki lojja','onek lojja','khub lojja','lojjajonok',
    'raga lagche','onek raga','khub raga','boro raga','raga hocche','ami ragi',
    'mone hoy na','thik na','ei kaj thik na','kharap kaj korecho','eto kharap keno',
    'jhut kotha','mithhe kotha','shotti na','ei jhut','shob jhut','jhuther dal',
    'tumi kharap','o kharap','she kharap','tara kharap','shobai kharap',
    'onek kharap kaj','amra raji na','notun fande feleche','abar dhoka',
    'ki oshovyo','opomankar','nishthurer dal','shadhin na','beshi kharap',
    'chokh tule dekhte paro na','manushik na','manush na','pashu','boro pashu',
    'chor chor','thag thag','dhormer kothay adhorm','bichar chai','bichar hok',
    'shamne asho','baire asho','uttor dao','jabab dao','hishab dao',
    'chap diye racho','jhame poreche','bipoode poreche','shotru','boro shotru',
    'prokrito shotru','durotto thako','dur thako','door hao',
    'bebostha','durvoga','dukher kotha','koster kotha','jontrona','perao',
    'opomaon','opomaner','opomaonito','opomaon kora','opomaon hoyeche',
    'mithhuker shongho','dornoitir shongho','bicharhoeen','bicharheen',
    'mene nibo na','mante parchi na','shojjo nai','shojjo hocche na','aro shojjo na',
    // ── Bangla ───────────────────────────────────────────────────────────────
    'খারাপ','বাজে','ঘৃণা','মিথ্যা','ফালতু','বেকার','বিরক্ত','রাগ','দুঃখ','কষ্ট','লজ্জা',
    'ঘৃণ্য','নিষ্ঠুর','অসৎ','প্রতারক','দুর্নীতি','অপমান','ক্রোধ','হতাশ',
    'বিপদ','ক্ষতি','ধোঁকা','চোর','সহিংস','ভয়','অন্যায়','নষ্ট',
    'মিথ্যুক','কপট','দুষ্ট','অলস','অকর্মা','বেশরম','বেহায়া',
    'ঘৃণা করি','একদম বাজে','বাজে মানুষ','খুব খারাপ','মন্দ','ক্ষতিকর',
    'অপরাধী','অযোগ্য','নির্লজ্জ','বেআদব','অহংকারী','স্বার্থপর',
    'কাপুরুষ','প্রতারণা','ভণ্ড','ধোঁকাবাজ','ধোকা','খুব বাজে',
    'একদম খারাপ','অনেক খারাপ','এত খারাপ','কেন এত খারাপ',
    'বিরক্তিকর','অসহ্য','রাগ লাগছে','রাগান্বিত','মন খারাপ',
    'হতাশাজনক','ব্যর্থ','ব্যর্থতা','শত্রু','ক্ষতিকারক','বিপজ্জনক',
    'অবিশ্বাসযোগ্য','অনৈতিক','অন্যায়কারী','ক্ষমার অযোগ্য',
    'লজ্জাজনক','অযোগ্য কাজ','খারাপ কাজ','মিথ্যাচার','জঘন্য',
    // ── Additional Bangla: violence, demands for justice, insults ────────────
    'ফাঁসি','হত্যা','হত্যাকাণ্ড','হত্যাকারী','খুন','খুনি',
    'মারো','মারা','মার ','মারিয়া','মারিলায়','মেরে ফেলো','মেরে ফেলুন',
    'শালার','শালা','হারামি','কুকুর','গাধা','বেজন্মা','জানোয়ার',
    'বাটপার','বদমাশ','দুষ্কৃতী','সন্ত্রাসী','গুন্ডা',
    'বিচার চাই','বিচার দাও','বিচার হোক','ন্যায়বিচার চাই',
    'ধিক্','ধিক্কার','ছিঃ','ছি ছি','থু','থু থু',
    'নিকৃষ্ট','পচা','বগার','ধ্বংস','ধ্বংস হোক','মরুক','মরে যাক',
    'বন্ধ করো','বন্ধ করা দরকার','বন্ধ হোক',
    'অপদার্থ','নালায়েক','মূর্খ','অকেজো','দায়িত্বহীন','গাফিলতি','অবহেলা',
    'রাজাকার','দালাল','শুয়োর','গু','পা চাটা','মব','মাদারবোর্ড','দজ্জাল','চুদ লিং পাং',
    // ── Bangla (extended) ─────────────────────────────────────────────────────
    'ঘৃণা লাগছে','ঘৃণা হচ্ছে','ঘৃণা করছি','অসম্মানজনক','অপমানজনক','অপমান করা',
    'কতটা খারাপ','কত খারাপ','কী খারাপ','এতটা খারাপ','এত বাজে','এতটা বাজে',
    'অসভ্য','অভদ্র','নোংরা','নোংরা মানসিকতা','নিচু মানসিকতা','নিচু মনের',
    'বেআইনি','অবৈধ','দুর্নীতিবাজ','দুর্নীতিগ্রস্ত','প্রতারণামূলক','প্রতারণাপূর্ণ',
    'অন্যায়ভাবে','অন্যায় কাজ','মিথ্যাবাদী','কুচক্রী','চক্রান্তকারী','ষড়যন্ত্রকারী',
    'অসৎ মানুষ','চোরের দল','ঘৃণ্য কাজ','ক্ষমার অযোগ্য কাজ','মাফ করার যোগ্য না',
    'এটা মেনে নেওয়া যায় না','মেনে নেব না','মানছি না','মানা যায় না','অগ্রহণযোগ্য',
    'বয়কট','প্রতিবাদ করি','নিন্দা জানাই','ধিক্কার জানাই','শাস্তি চাই',
    'এরকম হওয়া উচিত না','হওয়া উচিত হয়নি','কেন করলে এটা','কেন করলেন',
    'রাগ হচ্ছে','অনেক রাগ লাগছে','অসহ্য লাগছে','সহ্য হচ্ছে না','মাথায় রাগ উঠেছে',
    'মন ভেঙে গেছে','মনটা খারাপ','মন খারাপ হয়ে গেলো','কান্না আসছে','চোখে জল',
    'দুঃখজনক','বেদনাদায়ক','হৃদয়বিদারক','কষ্টকর','যন্ত্রণাদায়ক','পীড়াদায়ক',
    'আতঙ্কিত','ভয় লাগছে','ভয় পাচ্ছি','আতঙ্ক','ভীত','আতঙ্কজনক',
    'নির্যাতন','নির্যাতিত','অত্যাচার','অত্যাচারিত','নিপীড়ন','নিপীড়িত',
    'নিষ্ঠুরতা','নৃশংসতা','বর্বরতা','পশুত্ব','অমানবিক','অমানবিকতা',
    'দোষী','অপরাধ','অপরাধমূলক','বিচারহীন','বিচারহীনতা','দায়মুক্তি',
    'স্বৈরাচার','স্বৈরশাসন','একনায়কতন্ত্র','ফ্যাসিবাদ','দমনপীড়ন',
    'বিশ্বাসঘাতক','বিশ্বাসঘাতকতা','পিঠে ছুরি মারা','ধোঁকাবাজি',
    'ক্ষমা নেই','ক্ষমা করব না','ক্ষমা করা যায় না','ক্ষমার যোগ্য না',
    'সমালোচনা করি','নিন্দা করি','প্রতিবাদ জানাই','আওয়াজ তুলি','রুখে দাঁড়াই',
    'এই সরকার','এই নেতা','এই দল','এদের বিরুদ্ধে','এর বিরুদ্ধে',
    'দুর্নীতিমুক্ত চাই','পরিবর্তন চাই','বদল চাই','সংস্কার চাই',
];
const EMOJI_POS = ['❤️','😍','😊','🥰','👍','🙏','💕','😁','✨','🌟','😃','😄','🎉','🎊','👏','💯','🔥','⭐','🌈','😇','🤩','💪','🙌','💖','💝','🌹','🌸','🤗','😘','🫶','🥳'];
const EMOJI_NEG = ['😡','😠','👎','🤮','😤','💔','😢','😭','🤬','😒','😔','😞','😟','😣','😩','😫','🤢','💀','🖕','🤦','😰','😱','🥺'];

// ═════════════════════════════════════════════════════════════════════════════
// LANGUAGE DETECTION  — Bangla Unicode block U+0980–U+09FF
// ═════════════════════════════════════════════════════════════════════════════
function isBangla(text) {
    if (!text || text.length < 2) return false;
    let count = 0;
    for (const ch of text) {
        const cp = ch.codePointAt(0);
        if (cp >= 0x0980 && cp <= 0x09FF) count++;
    }
    return (count / text.length) > 0.12;
}

// ═════════════════════════════════════════════════════════════════════════════
// TRANSLATION  — Google Translate free endpoint, no API key needed
//   Batches CHUNK comments per call; retries once on failure; 450 ms throttle.
// ═════════════════════════════════════════════════════════════════════════════
const _TSEP  = '\n◈◈◈\n';
const _CHUNK = 30;   // 30 texts per API call — halves the number of requests vs 15

async function _translateChunk(texts, retry) {
    const joined = texts.join(_TSEP);
    const url = 'https://translate.googleapis.com/translate_a/single' +
        '?client=gtx&sl=auto&tl=en&dt=t&q=' + encodeURIComponent(joined);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    try {
        const resp = await fetch(url, { signal: controller.signal });
        if (!resp.ok) throw new Error('HTTP ' + resp.status);
        const json = await resp.json();
        const full  = json[0].map(s => s[0]).join('');
        const parts = full.split(/\n?◈◈◈\n?/);
        return texts.map((orig, i) => (parts[i] || orig).trim());
    } catch(e) {
        if (!retry) {
            await sleep(1500);
            return _translateChunk(texts, true);   // one retry
        }
        return texts;  // give up — return originals
    } finally {
        clearTimeout(timer);
    }
}

async function translateResults(results) {
    const banglaIdxs = [];
    results.forEach((r, i) => { if (isBangla(r.comment)) banglaIdxs.push(i); });

    if (!banglaIdxs.length) {
        return results.map(r => ({ ...r, lang: 'en', translatedComment: '' }));
    }

    const txMap = {};

    for (let c = 0; c < banglaIdxs.length; c += _CHUNK) {
        if (_stopped) break;
        const slice = banglaIdxs.slice(c, c + _CHUNK);
        const done  = Math.min(c + _CHUNK, banglaIdxs.length);
        showStatus(
            'Step 5/5: Translating Bangla → English\n' +
            done + ' / ' + banglaIdxs.length + ' comments', '#7b2d8b'
        );
        const txts  = slice.map(i => results[i].comment);
        const trans = await _translateChunk(txts, false);
        slice.forEach((idx, j) => { txMap[idx] = trans[j]; });
        await sleep(300);   // was 450 — still safe from rate limiting
    }

    return results.map((r, i) => {
        const bn         = isBangla(r.comment);
        const translated = bn ? (txMap[i] || r.comment) : '';
        const scoreText  = translated || r.comment;
        const { label, score } = sentiment(scoreText);
        return { ...r, lang: bn ? 'bn' : 'en', translatedComment: translated, sentiment: label, score };
    });
}

// ═════════════════════════════════════════════════════════════════════════════
// TEXT + SENTIMENT
// ═════════════════════════════════════════════════════════════════════════════
function getText(el) {
    if (!el) return '';
    const p = [];
    const walk = n => {
        if (n.nodeType === Node.TEXT_NODE)      p.push(n.textContent);
        else if (n.nodeName === 'IMG' && n.alt) p.push(n.alt);
        else if (n.nodeName === 'BR')           p.push('\n');
        else                                    n.childNodes.forEach(walk);
    };
    walk(el);
    return p.join('').replace(/\uFEFF/g, '').trim().replace(/[ \t]+/g, ' ');
}

function sentiment(text) {
    if (!text) return { label: 'Neutral', score: 0 };
    const lo = text.toLowerCase();
    let s = 0;
    for (const w of POSITIVE_WORDS) if (lo.includes(w.toLowerCase())) s++;
    for (const w of NEGATIVE_WORDS) if (lo.includes(w.toLowerCase())) s--;
    for (const e of EMOJI_POS) if (text.includes(e)) s++;
    for (const e of EMOJI_NEG) if (text.includes(e)) s--;
    return { label: s > 0 ? 'Positive' : s < 0 ? 'Negative' : 'Neutral', score: +s.toFixed(2) };
}

// Facebook UI strings that should never be treated as comment text
const _UI_RE = /^(like|reply|see translation|write a (comment|reply)|most relevant|all comments|newest first|\d+[smhdwy]|\d+\s+(like|love|reaction|comment|share)s?|follow|share|view profile|view more|hide repl(y|ies)|load more|top comments|comment|comments|view\s+(\w+\s+)?\d+\s+repl(y|ies)|[\d,.]+\s*[kmbt]?\s+views?|see all|notifications?|unread|not now|turn on|turn off|earlier|mark all as read|push notifications?|mark as read|all caught up|no new notifications?|settings?)$/i;
function isUIText(t) {
    if (!t || t.length < 2) return true;
    const s = t.trim();
    if (_UI_RE.test(s)) return true;
    // Dot/bullet prefix + UI action:  "· Follow", "· Share"
    if (/^[·•]\s*(follow|share|like|reply|comment|view|see)$/i.test(s)) return true;
    // Date stamps: "12 Feb", "12 Feb ·", "Jan 12 ·", "12 February"
    if (/^\d{1,2}\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s*[·•]?\s*$/i.test(s)) return true;
    if (/^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{1,2}\s*[·•]?\s*$/i.test(s)) return true;
    // Internal Facebook hash/token IDs — no spaces, mixed alphanumeric, 12+ chars, 3+ digits
    if (s.length >= 12 && !s.includes(' ') && /^[a-zA-Z0-9_\-]+$/.test(s) && (s.match(/\d/g) || []).length >= 3) return true;
    // Bare domain names: "RggYKHG.com", "example.com"
    if (/^[a-zA-Z0-9][a-zA-Z0-9\-]*\.[a-zA-Z]{2,}$/.test(s) && !s.includes(' ')) return true;
    // Full URLs
    if (/^https?:\/\//i.test(s)) return true;
    return false;
}

// ═════════════════════════════════════════════════════════════════════════════
// CSV + DOWNLOAD
// ═════════════════════════════════════════════════════════════════════════════
function buildCSV(data) {
    const hasPosts = data.some(r => r.post && r.post !== '');
    const hasTrans = data.some(r => r.translatedComment && r.translatedComment !== '');
    // Use ?? instead of || so that 0 / false / NaN are not coerced to empty string.
    const q = s => '"' + String(s == null ? '' : s).replace(/"/g, '""') + '"';

    const hdrs = [];
    if (hasPosts) hdrs.push('Post');
    hdrs.push('Name', 'Language', 'Comment');
    if (hasTrans) hdrs.push('TranslatedComment');
    hdrs.push('Sentiment', 'Score');

    const rows = data.map(r => {
        const row = [];
        if (hasPosts) row.push(q(r.post));
        row.push(q(r.name));
        row.push(q(r.lang === 'bn' ? 'Bangla' : 'English'));
        row.push(q(r.comment));
        if (hasTrans) row.push(q(r.translatedComment || ''));
        row.push(q(r.sentiment), q(r.score));
        return row.join(',');
    });

    return '\uFEFF' + hdrs.join(',') + '\n' + rows.join('\n');
}

function downloadCSV(data, filename = 'fb_sentiment.csv') {
    const csv = buildCSV(data);
    try {
        // Direct Blob download — avoids Chrome IPC size limit for large datasets
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        setTimeout(() => { try { URL.revokeObjectURL(url); a.remove(); } catch (_) {} }, 3000);
    } catch (e) {
        // Fallback: route through background script (works for smaller datasets)
        chrome.runtime.sendMessage({ action: 'downloadCSV', csv, filename });
    }
}

// ═════════════════════════════════════════════════════════════════════════════
// PIE CHART OVERLAY
// ═════════════════════════════════════════════════════════════════════════════
function showChart(data) {
    const old = document.getElementById('_fb_chart_overlay');
    if (old) old.remove();

    const pos     = data.filter(x => x.sentiment === 'Positive').length;
    const neg     = data.filter(x => x.sentiment === 'Negative').length;
    const neu     = data.filter(x => x.sentiment === 'Neutral').length;
    const total   = data.length;
    const bnCount = data.filter(x => x.lang === 'bn').length;
    const transOk = data.filter(x => x.translatedComment).length;

    const ov = document.createElement('div');
    ov.id = '_fb_chart_overlay';
    Object.assign(ov.style, {
        position: 'fixed', top: '0', left: '0', width: '100%', height: '100%',
        background: 'rgba(0,0,0,0.62)', zIndex: '2147483646',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
    });

    const box = document.createElement('div');
    Object.assign(box.style, {
        background: '#fff', borderRadius: '18px', padding: '28px 32px',
        width: '390px', fontFamily: 'Arial, sans-serif', textAlign: 'center',
        boxShadow: '0 16px 60px rgba(0,0,0,0.5)', maxHeight: '92vh', overflowY: 'auto',
    });

    const langBar = bnCount > 0
        ? `<div style="background:#f3e8ff;border-radius:8px;padding:7px 12px;margin-bottom:14px;font-size:12px;color:#7b2d8b;text-align:left">` +
          `<b>${bnCount}</b> Bangla translated → English &nbsp;·&nbsp; <b>${total - bnCount}</b> English` +
          (transOk < bnCount ? `<br><span style="color:#e07800">${bnCount - transOk} used original (API limit)</span>` : '') + `</div>` : '';

    const scoreNote = transOk > 0 ? 'Sentiment scored on translated English text' : 'Sentiment scored on original text';

    box.innerHTML =
        '<h2 style="margin:0 0 4px;color:#1877f2;font-size:20px;font-weight:800">Sentiment Results</h2>' +
        '<p style="margin:0 0 14px;color:#888;font-size:13px">' + total + ' comments analysed &nbsp;·&nbsp; <span style="color:#aaa;font-size:11px">' + scoreNote + '</span></p>' +
        langBar +
        '<canvas id="_fb_pie_canvas" width="240" height="240" style="display:block;margin:0 auto 18px"></canvas>' +
        '<div id="_fb_pie_legend" style="text-align:left;margin-bottom:18px"></div>' +
        '<div style="display:flex;gap:10px">' +
        '<button id="_fb_chart_dl" style="flex:1;padding:10px;background:#42b72a;color:#fff;border:none;border-radius:8px;cursor:pointer;font-weight:bold;font-size:13px">Download CSV</button>' +
        '<button id="_fb_chart_close" style="flex:1;padding:10px;background:#1877f2;color:#fff;border:none;border-radius:8px;cursor:pointer;font-weight:bold;font-size:13px">Close</button>' +
        '</div>';

    ov.appendChild(box);
    document.body.appendChild(ov);

    document.getElementById('_fb_chart_close').onclick = () => ov.remove();
    document.getElementById('_fb_chart_dl').onclick    = () => downloadCSV(data);
    ov.addEventListener('click', e => { if (e.target === ov) ov.remove(); });

    const canvas = document.getElementById('_fb_pie_canvas');
    const ctx    = canvas.getContext('2d');
    const cx = 120, cy = 120, OUTER = 108, INNER = 54;
    const slices  = [
        { label: 'Positive', count: pos, color: '#42b72a' },
        { label: 'Negative', count: neg, color: '#e41e2b' },
        { label: 'Neutral',  count: neu, color: '#f0a500' },
    ];
    const nonZero = slices.filter(s => s.count > 0);

    if (!nonZero.length) {
        ctx.font = '14px Arial'; ctx.fillStyle = '#aaa';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('No data', cx, cy);
    } else {
        let angle = -Math.PI / 2;
        for (const s of nonZero) {
            const sweep = (s.count / total) * 2 * Math.PI;
            ctx.beginPath(); ctx.moveTo(cx, cy);
            ctx.arc(cx, cy, OUTER, angle, angle + sweep);
            ctx.closePath(); ctx.fillStyle = s.color; ctx.fill();
            ctx.beginPath(); ctx.moveTo(cx, cy);
            ctx.arc(cx, cy, OUTER, angle, angle + sweep);
            ctx.closePath(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
            if (sweep > 0.22) {
                const mid = angle + sweep / 2;
                ctx.fillStyle = '#fff'; ctx.font = 'bold 12px Arial';
                ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                ctx.fillText(((s.count / total) * 100).toFixed(1) + '%',
                    cx + OUTER * 0.68 * Math.cos(mid), cy + OUTER * 0.68 * Math.sin(mid));
            }
            angle += sweep;
        }
        ctx.beginPath(); ctx.arc(cx, cy, INNER, 0, 2 * Math.PI);
        ctx.fillStyle = '#fff'; ctx.fill();
        ctx.fillStyle = '#222'; ctx.font = 'bold 22px Arial';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(total, cx, cy - 10);
        ctx.font = '11px Arial'; ctx.fillStyle = '#999';
        ctx.fillText('comments', cx, cy + 12);
    }

    const legend = document.getElementById('_fb_pie_legend');
    for (const s of slices) {
        const pct = total ? ((s.count / total) * 100).toFixed(1) : '0.0';
        const row = document.createElement('div');
        Object.assign(row.style, { display: 'flex', alignItems: 'center', marginBottom: '8px' });
        row.innerHTML =
            '<span style="width:14px;height:14px;background:' + s.color + ';border-radius:3px;display:inline-block;margin-right:10px;flex-shrink:0"></span>' +
            '<span style="font-size:13px;color:#333">' + s.label + ': <b>' + s.count + '</b> <span style="color:#999">(' + pct + '%)</span></span>';
        legend.appendChild(row);
    }
}

// ═════════════════════════════════════════════════════════════════════════════
// CORE UTILITIES
// ═════════════════════════════════════════════════════════════════════════════
async function waitFor(fn, ms) {
    const end = Date.now() + (ms || 8000);
    while (Date.now() < end) {
        if (_stopped) return null;
        const v = fn();
        if (v) return v;
        await sleep(250);
    }
    return fn();
}

function fireClick(el) {
    if (!el) return;
    try { el.scrollIntoView({ block: 'center', behavior: 'instant' }); } catch(e) {}
    try {
        const r = el.getBoundingClientRect();
        const x = r.left + r.width / 2, y = r.top + r.height / 2;
        const o = { bubbles: true, cancelable: true, composed: true, view: window, clientX: x, clientY: y };
        // Only pointer-down/up — no synthetic 'click' here; el.click() below fires the real one
        ['pointerdown','mousedown','pointerup','mouseup'].forEach(t =>
            el.dispatchEvent(new PointerEvent(t, Object.assign({}, o, { pointerId: 1, pointerType: 'mouse', isPrimary: true })))
        );
    } catch(e) {}
    try { el.click(); } catch(e) {}   // single click — not double
}

function clickEl(el) {
    if (!el) return;
    fireClick(el);
    const btn = el.closest('a,button,[role="button"],[role="link"]');
    if (btn && btn !== el) fireClick(btn);
}

function byXPath(xpath) {
    try {
        const n = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
        return n ? (n.nodeType === Node.ELEMENT_NODE ? n : n.parentElement) : null;
    } catch(e) { return null; }
}

// ═════════════════════════════════════════════════════════════════════════════
// DOM FINDERS
// ═════════════════════════════════════════════════════════════════════════════
function findMostRelevant() {
    const root = getCommentRoot();
    for (const el of root.querySelectorAll('[role="button"]')) {
        const t = (el.innerText || el.textContent || '').trim();
        if (t === 'Most relevant' || (t.startsWith('Most relevant') && t.length < 40)) return el;
    }
    for (const el of root.querySelectorAll('span')) {
        const t = (el.innerText || el.textContent || '').trim();
        if (t === 'Most relevant') return el.closest('[role="button"]') || el;
    }
    return byXPath(MOST_RELEVANT_XPATH);
}

function findAllComments() {
    // Look inside dropdown/menu containers first (most specific)
    for (const sel of ['[role="menuitem"]', '[role="option"]', '[role="menu"] [role="button"]', '[role="listbox"] [role="option"]']) {
        for (const el of document.querySelectorAll(sel)) {
            const t = (el.innerText || el.textContent || '').trim();
            if (t === 'All comments' || t.startsWith('All comments')) return el;
        }
    }
    // Broad span search — return nearest clickable ancestor if found
    for (const el of document.querySelectorAll('span')) {
        const t = (el.innerText || el.textContent || '').trim();
        if (t === 'All comments') return el.closest('[role="menuitem"],[role="option"],[role="button"]') || el;
    }
    // XPath fallback
    return byXPath(ALL_COMMENTS_XPATH);
}

function findCommentBtns() {
    // Handles plain counts ("134 comments") AND abbreviated counts ("1.4K comments",
    // "5.2K comments", "2.1M comments") — the old /^\d+\s+comments?$/ failed on K/M values
    // because "1.4K" contains a decimal and a letter that \d+ cannot match past the "1".
    const EXACT_RE = /^[\d,.]+[KkMmBbTt]?\s+comments?$/i;
    const LOOSE_RE = /[\d,.]+[KkMmBbTt]?\s+comments?/i;

    let els = Array.from(document.querySelectorAll('span,a'))
        .filter(el => EXACT_RE.test((el.textContent || '').trim()));
    if (els.length) return els;
    els = Array.from(document.querySelectorAll('span,a'))
        .filter(el => { const t = (el.textContent || '').trim(); return LOOSE_RE.test(t) && t.length < 40; });
    if (els.length) return els;
    // Fallback: count ("134") and label ("Comments") may live in separate child spans
    // inside a [role="button"] — match the button by its combined textContent.
    els = Array.from(document.querySelectorAll('[role="button"]'))
        .filter(el => { const t = (el.textContent || '').trim(); return LOOSE_RE.test(t) && t.length < 80; });
    return els;
}

// ── "View more" buttons — broad scan of role="button" elements ────────────
//   This replaces the narrow span.xdmh292 approach that missed most buttons.
function findViewMoreBtns(root) {
    const r = root || document;
    const KEYWORDS_EN = [
        'view more comments', 'see more comments',
        'view more replies',  'see more replies',
        'load more comments', 'view all comments',
        'view previous comments',
    ];
    const KEYWORDS_BN = [
        'আরও মন্তব্য', 'আরও দেখুন', 'সব দেখুন',
        'আরও প্রতিক্রিয়া', 'প্রতিমন্তব্য দেখুন', 'পূর্ববর্তী মন্তব্য',
    ];
    const ALL_KW = [...KEYWORDS_EN, ...KEYWORDS_BN];

    // Covers: "view 3 replies", "view all 3 replies", "see 5 more comments", etc.
    // IMPORTANT: must NOT match "134 Comments" (the post's comment-open button).
    // Old pattern `/\d+\s+(more\s+)?(comments?|repl(y|ies))/i` matched bare "N Comments"
    // which on post-permalink pages (root=document) caused the scraper to keep clicking
    // the wrong button.  New pattern requires an action verb OR "more" to be present.
    const REPLY_COUNT_RE  = /view\s+(\w+\s+)?\d+\s+repl(y|ies)/i;
    const NUM_COMMENT_RE  = /(\d+\s+more\s+(comments?|repl(y|ies))|(view|see|load|all)\s+(\w+\s+)?\d+\s+(comments?|repl(y|ies)))/i;

    const seen  = new Set();
    const found = [];

    // :not([data-fbvm]) skips already-clicked buttons → prevents O(n²) re-scan.
    // textContent (not innerText) avoids expensive layout reflows.
    for (const el of r.querySelectorAll('[role="button"]:not([data-fbvm]), button:not([data-fbvm])')) {
        const t = (el.textContent || '').trim();
        if (!t || t.length > 120) continue;
        const tl = t.toLowerCase();
        if (ALL_KW.some(k => tl.includes(k.toLowerCase())) || REPLY_COUNT_RE.test(t) || NUM_COMMENT_RE.test(t)) {
            if (!seen.has(el)) { seen.add(el); found.push(el); }
        }
    }

    // Also check span.xdmh292 (the old class) as supplemental.
    // IMPORTANT: apply the same regex checks here — "View all 2 replies" matches
    // NUM_COMMENT_RE and REPLY_COUNT_RE but does NOT match any ALL_KW keyword,
    // so without the regex check these reply-expand buttons are silently missed,
    // causing the scraper to hit MAX_IDLE early and stop before all replies load.
    for (const el of r.querySelectorAll('span.xdmh292')) {
        const t  = (el.textContent || '').trim();
        const tl = t.toLowerCase();
        if (ALL_KW.some(k => tl.includes(k.toLowerCase())) || REPLY_COUNT_RE.test(t) || NUM_COMMENT_RE.test(t)) {
            const btn = el.closest('[role="button"],button') || el;
            if (!btn.hasAttribute('data-fbvm') && !seen.has(btn)) {
                seen.add(btn); found.push(btn);
            }
        }
    }

    return found;
}

// ─────────────────────────────────────────────────────────────────────────────
// FIXED: findCommentScrollArea()
//
// BUG in the old findCommentContainer():
//   It walked up from findMostRelevant() (the "Most relevant" sort button).
//   After sortToAllComments() clicks "All comments", that button disappears
//   from the DOM → findMostRelevant() returns undefined → the whole function
//   returns null → scrollAndCollect() hits the dead-end `else { sleep(900) }`
//   branch and never scrolls → only the initially-visible ~4 comments are seen.
//
// FIX: Walk up from the FIRST [role="article"] comment element instead.
//   Comment articles are always present once the section is open.
//   Secondary fallback: scan the dialog's children for any scrollable div.
// ─────────────────────────────────────────────────────────────────────────────
function findCommentScrollArea() {
    if (_scrollArea && document.contains(_scrollArea)) return _scrollArea;

    const root = getCommentRoot();

    // Helper: does this element have a scrollable overflow style?
    // Includes 'overlay' — Chrome-specific value that Facebook uses frequently.
    // No scrollHeight > clientHeight guard here: that check fails when only
    // 1-2 comments are loaded and the container is not yet overflowing.
    function canScroll(el) {
        if (!el || el.clientHeight < 80) return false;
        const ov = window.getComputedStyle(el).overflowY;
        return ov === 'auto' || ov === 'scroll' || ov === 'overlay';
    }

    // Strategy A — walk up from first article; the first scrollable ancestor IS the
    // comment scroll container.  No scrollHeight guard — it fails on fresh load.
    const firstArticle = root.querySelector('[role="article"]');
    if (firstArticle) {
        let el = firstArticle.parentElement;
        for (let i = 0; i < 25 && el && el !== document.body; i++) {
            if (canScroll(el)) return (_scrollArea = el);
            el = el.parentElement;
        }
    }

    // Strategy B — BFS from dialog; collect all scrollable candidates and pick the
    // one that contains the most articles (= the comment list container).
    const dialog = document.querySelector('[role="dialog"],[aria-modal="true"],[aria-modal]');
    if (dialog) {
        const queue = [dialog];
        const candidates = [];
        while (queue.length) {
            const node = queue.shift();
            for (const child of node.children) {
                if (canScroll(child)) candidates.push(child);
                queue.push(child);
            }
        }
        candidates.sort((a, b) =>
            b.querySelectorAll('[role="article"]').length -
            a.querySelectorAll('[role="article"]').length
        );
        if (candidates.length) return (_scrollArea = candidates[0]);
    }

    // Strategy C — inline overflow style (catches elements with style attribute only)
    for (const el of document.querySelectorAll('div[style]')) {
        const s = el.getAttribute('style') || '';
        if (/overflow(-y)?:\s*(auto|scroll|overlay)/i.test(s) &&
            el.scrollHeight > el.clientHeight + 80 &&
            el.querySelector('[role="article"]')) {
            return (_scrollArea = el);
        }
    }

    // Strategy D — height-based heuristic: walk up from first article and find
    // the first div taller than the article.  Works even when overflow CSS is
    // undetectable (e.g. very few comments loaded so container not yet overflowing).
    if (firstArticle) {
        const artH = firstArticle.clientHeight || 50;
        for (let el = firstArticle.parentElement; el && el !== document.body; el = el.parentElement) {
            if (el.tagName === 'DIV' && el.clientHeight > artH + 60 && el.clientHeight > 100) {
                return (_scrollArea = el);
            }
        }
    }

    return null;
}

function commentsAreOpen() {
    if (findMostRelevant()) return true;
    const root = getCommentRoot();
    if (root.querySelectorAll('[role="article"]').length >= 2) return true;
    const dialog = document.querySelector('[role="dialog"],[aria-modal="true"],[aria-modal]');
    if (dialog && dialog.querySelector('[role="article"]')) return true;
    return false;
}

function isPostPage() {
    return /\/(posts|permalink|photo|video|videos|groups\/[^/]+\/posts|reel)\//i.test(location.href) ||
           /[?&](story_fbid|fbid|id)=\d/i.test(location.href);
}

function getCommentRoot() {
    // Priority 1: a dialog-like element that already has comment articles in it.
    // This ensures harvestVisible() / findCommentScrollArea() scope to the right container
    // even when multiple dialogs exist (e.g. notification panel + comment overlay).
    for (const el of document.querySelectorAll('[role="dialog"],[aria-modal="true"],[aria-modal]')) {
        if (el.querySelector('[role="article"]')) return el;
    }
    // Priority 2: any dialog element (articles may not be loaded yet at this call point).
    const dialog = document.querySelector('[role="dialog"],[aria-modal="true"],[aria-modal]');
    if (dialog) return dialog;
    return document;
}

// ═════════════════════════════════════════════════════════════════════════════
// PHASE 1: OPEN COMMENT SECTION
// ═════════════════════════════════════════════════════════════════════════════
async function openCommentSection() {
    if (commentsAreOpen()) return true;

    const btns = findCommentBtns();
    if (!btns.length) {
        // Try both layout variants before giving up
        const xEl = byXPath(COMMENTS_BTN_XPATH) || byXPath(COMMENTS_BTN_XPATH_2);
        if (xEl) btns.push(xEl); else return false;
    }

    const btn     = btns[0];
    const prevURL = location.href;
    showStatus('Step 1/5: Opening comment section...');

    let cur = btn;
    for (let i = 0; i < 6 && cur && cur !== document.body; i++, cur = cur.parentElement) {
        if (_stopped) return false;
        fireClick(cur);
        await sleep(200);
        if (commentsAreOpen() || location.href !== prevURL) break;
    }

    const ok = await waitFor(() => commentsAreOpen() || (location.href !== prevURL && 'nav'), 8000);
    if (ok === 'nav') {
        showStatus('Step 1/5: Loading post page...');
        await sleep(3000);
    }
    return commentsAreOpen();
}

// ═════════════════════════════════════════════════════════════════════════════
// PHASE 2+3: SORT TO "ALL COMMENTS"
// ═════════════════════════════════════════════════════════════════════════════

// Finds "All comments" ONLY inside an open dropdown menu — never matches
// the sort-button label.  The old findAllComments() matched the label too,
// causing sortToAllComments() to open/close the dropdown 8× unnecessarily.
function findAllCommentsInDropdown() {
    // Facebook uses different roles depending on layout: menuitem, option, radio, or plain button inside menu.
    for (const sel of ['[role="menuitem"]', '[role="option"]', '[role="radio"]',
                       '[role="menu"] [role="button"]',
                       '[role="listbox"] [role="option"]',
                       '[role="radiogroup"] [role="radio"]']) {
        for (const el of document.querySelectorAll(sel)) {
            const t = (el.innerText || el.textContent || '').trim();
            if (t === 'All comments' || t.startsWith('All comments')) return el;
        }
    }
    return null;
}

async function sortToAllComments() {
    if (!findMostRelevant()) return;
    showStatus('Step 2/5: Opening sort dropdown...');

    for (let i = 0; i < 8 && !findAllComments(); i++) {
        if (_stopped) return;
        const mr = findMostRelevant() || byXPath(MOST_RELEVANT_XPATH);
        if (mr) { clickEl(mr); await sleep(900); }
        else await sleep(400);
    }

    showStatus('Step 3/5: Selecting "All comments"...');

    for (let i = 0; i < 8 && findAllComments(); i++) {
        if (_stopped) return;
        const ac = findAllComments() || byXPath(ALL_COMMENTS_XPATH);
        if (ac) { clickEl(ac); await sleep(900); }
        else await sleep(400);
    }

    _scrollArea = null;
    await sleep(1400);
}

// ═════════════════════════════════════════════════════════════════════════════
// HARVEST VISIBLE COMMENTS
//   — Two strategies: role="article" (primary), walk-up (fallback)
//   — Filters out Facebook UI strings (Like, Reply, time stamps, etc.)
// ═════════════════════════════════════════════════════════════════════════════

// These are defined once outside the loop for performance (no per-article RegExp allocation).
const _SKIP_HREF  = /\/(notifications|settings|watch|marketplace|gaming|groups\/discover|pages\/create|hashtag|reels)\//i;
// __tn__ is a Facebook tracking param appended to PROFILE links (e.g. /john.doe?__tn__=R).
// Blocking it caused the fallback to reject every valid profile link → all names failed → 0 comments.
// Only comment_id and reaction_id reliably indicate non-profile links.
const _SKIP_PARAM = /[?&](comment_id|reaction_id)/i;

function harvestVisible(seen, postLabel) {
    const out  = [];
    const root = getCommentRoot();

    // ── Strategy 1: role="article" blocks ───────────────────────────────────
    // :not([data-fbsc]) skips already-processed articles → prevents O(n²) rescan
    for (const block of root.querySelectorAll('[role="article"]:not([data-fbsc])')) {
        // Mark immediately so we never re-process this node, even if it yields nothing
        block.setAttribute('data-fbsc', '1');

        // Skip the main post article (it contains h1/h2)
        if (block.querySelector('h1,h2,h3')) continue;

        let name = '';
        // Primary: a[role="link"] pointing to a profile.
        // GUARD: skip any link that is INSIDE a div[dir="auto"] — those are @mentions embedded
        // in reply text (e.g. "@Rumman Abid Aorno" in "Rumman Abid Aorno actual reply text").
        // Without this guard the @mention name can be mistaken for the reply author's name.
        // SPAN SELECTOR: prefer span[dir="auto"] (= span.xdmh292 name span, 2 levels deep inside
        // the link) over the first generic span, for a more direct and accurate name read.
        for (const link of block.querySelectorAll('a[role="link"]')) {
            const href = link.getAttribute('href') || '';
            if (!href || href === '#' || _SKIP_HREF.test(href)) continue;
            if (link.closest('div[dir="auto"]')) continue;   // @mention inside comment text — skip
            // span[dir="auto"] targets the xdmh292 name span directly; any span is the fallback.
            const sp = link.querySelector('span[dir="auto"]') || link.querySelector('span');
            const c = (sp ? (sp.innerText || sp.textContent || '') :
                            (link.innerText || link.textContent || ''))
                        .replace(/\uFEFF/g, '').trim();
            if (c && c.length > 0 && c.length < 100 &&
                !/^\d+/.test(c) && !isUIText(c)) { name = c; break; }
        }
        // Fallback: any a[href] that looks like a profile URL (inline layout).
        // Some inline layouts use plain <a> without role="link".
        if (!name) {
            for (const link of block.querySelectorAll('a[href]')) {
                const href = link.getAttribute('href') || '';
                if (!href || href === '#' || _SKIP_HREF.test(href) || _SKIP_PARAM.test(href)) continue;
                if (link.closest('div[dir="auto"]')) continue;   // @mention — skip
                const c = (link.innerText || link.textContent || '').replace(/\uFEFF/g, '').trim();
                if (c && c.length > 1 && c.length < 80 &&
                    !/^\d/.test(c) && !isUIText(c)) { name = c; break; }
            }
        }
        if (!name) continue;

        // Comment text — pick the longest non-UI text div/span with dir="auto".
        // div[dir="auto"] = comment body (may start with @mention <a> — getText() includes it).
        // span[dir="auto"] = name span inside <a> → filtered by td.closest('a').
        let comment = '';
        for (const td of block.querySelectorAll('div[dir="auto"], span[dir="auto"]')) {
            if (td.closest('a')) continue;
            const t = getText(td);
            if (t && t !== name && !isUIText(t) && t.length > comment.length) comment = t;
        }
        if (!comment || comment.length < 2) continue;

        const key = name + '\x00' + comment.substring(0, 120);
        if (seen.has(key)) continue;
        seen.add(key);
        const { label, score } = sentiment(comment);
        out.push({ post: postLabel, name, comment, sentiment: label, score, lang: '', translatedComment: '' });
    }

    // ── Strategy 2: walk-up fallback (when no articles found) ───────────────
    // Only activate when there are truly no article containers visible at all.
    // Same name-extraction rules as Strategy 1:
    //   • skip links inside div[dir="auto"] (@mentions inside reply text)
    //   • prefer span[dir="auto"] (= span.xdmh292 name span) over generic span
    if (out.length === 0 && root.querySelectorAll('[role="article"]').length < 2) {
        for (const textDiv of root.querySelectorAll('div[dir="auto"], span[dir="auto"]')) {
            if (textDiv.closest('a')) continue;
            const comment = getText(textDiv);
            if (!comment || comment.length < 3 || isUIText(comment)) continue;
            let container = textDiv.parentElement;
            for (let i = 0; i < 20 && container && container !== document.body; i++) {
                let name = null;
                for (const link of container.querySelectorAll('a[role="link"]')) {
                    if (link.closest('div[dir="auto"]')) continue;  // @mention — skip
                    const sp = link.querySelector('span[dir="auto"]') || link.querySelector('span');
                    const c = (sp ? (sp.innerText || sp.textContent || '') :
                                   (link.innerText || link.textContent || ''))
                                .replace(/\uFEFF/g, '').trim();
                    if (c && c.length > 1 && c.length < 80 &&
                        c !== comment && !/^\d/.test(c) && !isUIText(c)) {
                        name = c; break;
                    }
                }
                if (name) {
                    const key = name + '\x00' + comment.substring(0, 120);
                    if (!seen.has(key)) {
                        seen.add(key);
                        const { label, score } = sentiment(comment);
                        out.push({ post: postLabel, name, comment, sentiment: label, score, lang: '', translatedComment: '' });
                    }
                    break;
                }
                container = container.parentElement;
            }
        }
    }

    return out;
}

// ═════════════════════════════════════════════════════════════════════════════
// PHASE 4: INCREMENTAL SCROLL + COLLECT
//
// Root cause of "only 4 comments" bug — fixed in findCommentScrollArea().
//
// Additional notes:
//   1. Container scroll + window scroll both attempted each round.
//   2. After clicking "View more", waits 1.6 s for FB to inject new DOM nodes.
//   3. MAX_ITEMS 10 000.
// ═════════════════════════════════════════════════════════════════════════════
async function scrollAndCollect(seen, postLabel) {
    const SEE_MORE_KW = [
        'see more', 'see more\u2026',
        '\u0986\u09b0\u09cb \u09a6\u09c7\u0996\u09c1\u09a8',
        '\u0986\u09b0\u09cb\u0993 \u09a6\u09c7\u0996\u09c1\u09a8',
    ];
    const MAX_IDLE  = 20;
    const SCROLL_PX = 800;     // larger step → fewer iterations
    const MAX_ITEMS = 10000;

    _scrollArea = null;        // reset scroll-area cache for this scrape run

    const results  = [];
    let idleRounds = 0;
    let prevSize   = 0;

    showStatus('Step 4/5: Collecting comments...\n0 collected');

    while (idleRounds < MAX_IDLE && !_stopped) {
        const root = getCommentRoot();

        // 1. Click "View more comments / replies"
        //    Mark each button with data-fbvm before clicking so findViewMoreBtns
        //    never returns it again — prevents re-clicking and O(n²) re-scan.
        const moreBtns = findViewMoreBtns(root);
        if (moreBtns.length) {
            for (const el of moreBtns) {
                if (_stopped) return results;
                el.setAttribute('data-fbvm', '1');
                clickEl(el);
            }
            await sleep(1600);   // was 2200 — FB usually responds within 1.5 s
        }

        // 2. Expand "See more" inside truncated comment text
        //    Collect all matches first, click all at once, then wait once.
        //    data-fbsm prevents re-checking already-visited buttons.
        let seeMoreClicked = 0;
        for (const el of root.querySelectorAll('[role="button"]:not([data-fbsm])')) {
            if (_stopped) return results;
            const t = (el.textContent || '').trim();
            el.setAttribute('data-fbsm', '1');
            if (t.length <= 20 && SEE_MORE_KW.some(s => t.toLowerCase() === s.toLowerCase())) {
                try { el.click(); seeMoreClicked++; } catch(e) {}
            }
        }
        if (seeMoreClicked > 0) await sleep(200);  // single wait, not per-click

        // 3. Harvest whatever is visible now
        const batch = harvestVisible(seen, postLabel);
        for (const item of batch) results.push(item);

        // 4. Scroll
        const container = findCommentScrollArea();
        if (container) {
            const beforeTop = container.scrollTop;
            container.scrollTop += SCROLL_PX;
            if (container.scrollTop === beforeTop) container.scrollTop = container.scrollHeight;
        }
        window.scrollBy(0, SCROLL_PX);
        document.documentElement.scrollTop += SCROLL_PX;

        await sleep(container ? 800 : 1000);

        // 5. Track idle rounds
        const currentSize = seen.size;
        showStatus(
            'Step 4/5: Collecting...\n' +
            results.length + ' comments | idle ' + idleRounds + '/' + MAX_IDLE +
            (container ? '' : '\n(searching for scroll area...)')
        );

        if (currentSize > prevSize) {
            idleRounds = 0;
            prevSize   = currentSize;
        } else {
            idleRounds++;
        }

        if (results.length >= MAX_ITEMS) {
            showStatus('Step 4/5: Reached ' + MAX_ITEMS + ' comment cap');
            await sleep(400);
            break;
        }
    }

    return results;
}

// ═════════════════════════════════════════════════════════════════════════════
// CLOSE DIALOG / COLLAPSE COMMENTS
// ═════════════════════════════════════════════════════════════════════════════
async function closeCurrentComments(prevURL, commentBtn) {
    if (location.href !== prevURL) {
        history.back();
        await sleep(3000);
        return;
    }
    const dialog = document.querySelector('[role="dialog"]');
    if (dialog) {
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', keyCode: 27, bubbles: true }));
        await sleep(800);
        const x = dialog.querySelector('[aria-label="Close"],[aria-label="close"]');
        if (x) { fireClick(x); await sleep(600); }
        return;
    }
    if (commentBtn) { try { commentBtn.click(); } catch(e) {} await sleep(600); }
}

// ═════════════════════════════════════════════════════════════════════════════
// BLUE BUTTON — Scrape the post currently open
// ═════════════════════════════════════════════════════════════════════════════
async function openAndScrape() {
    _paused  = false;
    _stopped = false;
    showStatus('FB Scraper: Starting...');

    try {
        const opened = await openCommentSection();
        if (!opened) {
            showStatus('Step 2/5: Looking for sort options...');
            await sleep(2000);
        }
        if (_stopped) return;

        await sortToAllComments();
        if (_stopped) return;

        const seen = new Set();
        let data   = await scrollAndCollect(seen, '');
        if (_stopped) return;

        if (!data.length) {
            hideStatus();
            alert('No comments found.\n\nTry:\n1. Reload the page (F5)\n2. Open the post directly (click its timestamp → permalink)\n3. Click Scrape This Post again');
            return;
        }

        // Step 5: translate Bangla → English
        if (_translateEnabled) {
            data = await translateResults(data);
        } else {
            data = data.map(r => ({ ...r, lang: isBangla(r.comment) ? 'bn' : 'en', translatedComment: '' }));
        }

        hideStatus();
        showChart(data);
    } catch(e) {
        hideStatus();
        alert('Error: ' + e.message);
    }
}

// ═════════════════════════════════════════════════════════════════════════════
// GREEN BUTTON — Scrape all posts on current FB feed / profile page
// ═════════════════════════════════════════════════════════════════════════════
async function scrapeAllPosts() {
    _paused  = false;
    _stopped = false;

    const MAX_POSTS  = 20;
    const all        = [];
    const seen       = new Set();
    let processed    = 0;
    let noNewCount   = 0;
    const MAX_NO_NEW = 5;

    showStatus('Finding posts on page...');
    await sleep(500);

    while (processed < MAX_POSTS && !_stopped) {
        const allBtns = findCommentBtns().filter(el => {
            const r = el.getBoundingClientRect();
            return r.top > -400 && r.top < window.innerHeight * 3;
        });
        const newBtns = allBtns.filter(el => !el.dataset.fbScraped);

        if (!newBtns.length) {
            noNewCount++;
            if (noNewCount >= MAX_NO_NEW) break;
            showStatus('Looking for more posts...\n' + processed + ' done, ' + all.length + ' comments');
            window.scrollBy(0, Math.round(window.innerHeight * 0.7));
            await sleep(2000);
            continue;
        }
        noNewCount = 0;

        for (const btn of newBtns) {
            if (processed >= MAX_POSTS || _stopped) break;
            btn.dataset.fbScraped = '1';
            if (/^0\s+comments?$/i.test((btn.textContent || '').trim())) continue;

            showStatus('Post ' + (processed + 1) + '/' + MAX_POSTS + ': Opening...\n' + all.length + ' collected');

            try { btn.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch(e) {}
            await sleep(700);

            const prevURL = location.href;
            let cur = btn;
            for (let lv = 0; lv < 6 && cur && cur !== document.body; lv++, cur = cur.parentElement) {
                if (_stopped) break;
                fireClick(cur);
                await sleep(200);
                if (commentsAreOpen() || location.href !== prevURL) break;
            }

            const ok = await waitFor(() => commentsAreOpen() || (location.href !== prevURL && 'nav'), 6000);
            if (ok === 'nav') await sleep(3000);

            if (commentsAreOpen()) {
                await sortToAllComments();
                if (!_stopped) {
                    const postData = await scrollAndCollect(seen, 'Post ' + (processed + 1));
                    for (const item of postData) all.push(item);
                    showStatus('Post ' + (processed + 1) + ': ' + postData.length + ' comments\nTotal: ' + all.length);
                }
                await closeCurrentComments(prevURL, btn);
            }

            processed++;
            await sleep(800);
        }

        window.scrollBy(0, Math.round(window.innerHeight * 0.7));
        await sleep(2000);
    }

    if (_stopped) return;

    if (!all.length) {
        hideStatus();
        alert('Checked ' + processed + ' posts — no comments found.\n\nTip: Use the Blue button on a specific post.');
        return;
    }

    let enriched = all;
    if (_translateEnabled) {
        enriched = await translateResults(all);
    } else {
        enriched = all.map(r => ({ ...r, lang: isBangla(r.comment) ? 'bn' : 'en', translatedComment: '' }));
    }

    hideStatus();
    showChart(enriched);
}

// ═════════════════════════════════════════════════════════════════════════════
// MESSAGE LISTENER
// ═════════════════════════════════════════════════════════════════════════════
chrome.runtime.onMessage.addListener((req, _sender, sendResponse) => {
    (async () => {
        if (typeof req.translate === 'boolean') _translateEnabled = req.translate;

        if (req.action === 'openAndScrape')  await openAndScrape();
        if (req.action === 'scrapeAllPosts') await scrapeAllPosts();
        if (req.action === 'pause') {
            _paused = true;
            if (_pauseBtn) { _pauseBtn.textContent = 'Resume'; _pauseBtn.style.background = 'rgba(255,200,0,0.55)'; }
        }
        if (req.action === 'resume') {
            _paused = false;
            if (_pauseBtn) { _pauseBtn.textContent = 'Pause'; _pauseBtn.style.background = 'rgba(255,255,255,0.28)'; }
        }
        if (req.action === 'stop') {
            _stopped = true; _paused = false; hideStatus();
        }
        sendResponse({ done: true });
    })();
    return true;
});
