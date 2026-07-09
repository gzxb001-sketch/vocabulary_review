/**
 * 考研高频词汇本地词库 — 多义项 + 熟词僻义
 * 每个词包含多个义项 (partOfSpeech + meaningZh + example + isObscure)
 */

export type MeaningEntry = {
  partOfSpeech: string;
  meaningZh: string;
  exampleSentence: string;
  exampleTranslation?: string;
  isObscure: boolean;
  isHighFreq: boolean;
};

export type LocalWordFullEntry = {
  phonetic: string;
  meanings: MeaningEntry[];
};

export const KAOYAN_WORD_MAP: Record<string, LocalWordFullEntry> = {
  // ==================== A ====================
  abandon: {
    phonetic: "/əˈbændən/",
    meanings: [
      { partOfSpeech: "vt.", meaningZh: "放弃；抛弃", isObscure: false, isHighFreq: true, exampleSentence: "Some scholars have abandoned the traditional approach in favor of a more empirical one.", exampleTranslation: "一些学者已放弃传统方法，转而采用更注重实证的方法。" },
      { partOfSpeech: "n.", meaningZh: "放纵；纵情", isObscure: true, isHighFreq: false, exampleSentence: "He danced with wild abandon at the celebration.", exampleTranslation: "他在庆典上纵情狂舞。" },
    ],
  },
  abstract: {
    phonetic: "/ˈæbstrækt/",
    meanings: [
      { partOfSpeech: "adj.", meaningZh: "抽象的", isObscure: false, isHighFreq: true, exampleSentence: "The concept is too abstract for most students to grasp without concrete examples.", exampleTranslation: "这个概念太抽象，大多数学生没有具体例子就无法理解。" },
      { partOfSpeech: "n.", meaningZh: "摘要；概要", isObscure: false, isHighFreq: false, exampleSentence: "The paper begins with a brief abstract summarizing the key findings.", exampleTranslation: "论文以一段简短的摘要开篇，概括了主要发现。" },
      { partOfSpeech: "vt.", meaningZh: "提取；抽取", isObscure: true, isHighFreq: false, exampleSentence: "The researchers abstracted the essential data from thousands of survey responses.", exampleTranslation: "研究人员从数千份调查回复中提取了关键数据。" },
    ],
  },
  account: {
    phonetic: "/əˈkaʊnt/",
    meanings: [
      { partOfSpeech: "n.", meaningZh: "账户；账目", isObscure: false, isHighFreq: false, exampleSentence: "The company's accounts showed a steady increase in revenue.", exampleTranslation: "公司的账目显示收入稳步增长。" },
      { partOfSpeech: "n.", meaningZh: "描述；报告", isObscure: false, isHighFreq: false, exampleSentence: "The witness gave a detailed account of what had happened.", exampleTranslation: "目击者对发生的事情做了详细描述。" },
      { partOfSpeech: "vi.", meaningZh: "占（比例）；解释", isObscure: false, isHighFreq: true, exampleSentence: "Private consumption accounts for over 60 percent of the country's GDP.", exampleTranslation: "居民消费占该国 GDP 的 60% 以上。" },
    ],
  },
  address: {
    phonetic: "/əˈdres/",
    meanings: [
      { partOfSpeech: "n.", meaningZh: "地址", isObscure: false, isHighFreq: false, exampleSentence: "Please provide your full name and mailing address.", exampleTranslation: "请提供您的全名和邮寄地址。" },
      { partOfSpeech: "vt.", meaningZh: "处理；解决", isObscure: false, isHighFreq: true, exampleSentence: "The report addresses several key issues concerning public health policy.", exampleTranslation: "该报告阐述了几个与公共卫生政策相关的关键问题。" },
      { partOfSpeech: "vt.", meaningZh: "演说；致辞", isObscure: true, isHighFreq: false, exampleSentence: "The president is expected to address the nation on the economic crisis.", exampleTranslation: "总统预计将就经济危机向全国发表讲话。" },
    ],
  },
  advance: {
    phonetic: "/ədˈvɑːns/",
    meanings: [
      { partOfSpeech: "n.", meaningZh: "进步；进展", isObscure: false, isHighFreq: true, exampleSentence: "Despite significant advances in medical technology, many diseases remain incurable.", exampleTranslation: "尽管医学技术取得了重大进步，许多疾病仍然无法治愈。" },
      { partOfSpeech: "vi.", meaningZh: "前进；推进", isObscure: false, isHighFreq: false, exampleSentence: "The troops advanced steadily toward the capital.", exampleTranslation: "部队稳步向首都推进。" },
      { partOfSpeech: "adj.", meaningZh: "预先的；提前的", isObscure: true, isHighFreq: false, exampleSentence: "Advance booking is strongly recommended during peak travel season.", exampleTranslation: "旅游旺季强烈建议提前预订。" },
    ],
  },
  appreciate: {
    phonetic: "/əˈpriːʃieɪt/",
    meanings: [
      { partOfSpeech: "vt.", meaningZh: "欣赏；感激", isObscure: false, isHighFreq: false, exampleSentence: "We greatly appreciate your contribution to this research.", exampleTranslation: "我们非常感谢您对本研究的贡献。" },
      { partOfSpeech: "vi.", meaningZh: "增值；升值", isObscure: true, isHighFreq: true, exampleSentence: "The value of the property has appreciated significantly over the past five years.", exampleTranslation: "该房产在过去五年中大幅升值。" },
    ],
  },
  argue: {
    phonetic: "/ˈɑːɡjuː/",
    meanings: [
      { partOfSpeech: "vi.", meaningZh: "争论；辩论", isObscure: false, isHighFreq: false, exampleSentence: "The two scholars argued for hours about the interpretation of the data.", exampleTranslation: "两位学者就数据的解读争论了好几个小时。" },
      { partOfSpeech: "vt.", meaningZh: "主张；认为", isObscure: false, isHighFreq: true, exampleSentence: "Some economists argue that inequality actually drives innovation.", exampleTranslation: "一些经济学家认为，不平等实际上推动了创新。" },
    ],
  },
  assume: {
    phonetic: "/əˈsjuːm/",
    meanings: [
      { partOfSpeech: "vt.", meaningZh: "假设；认为", isObscure: false, isHighFreq: false, exampleSentence: "The model assumes that all consumers make rational economic decisions.", exampleTranslation: "该模型假设所有消费者都做出理性的经济决策。" },
      { partOfSpeech: "vt.", meaningZh: "承担（责任）；就任", isObscure: true, isHighFreq: true, exampleSentence: "She assumed full responsibility for the project's failure.", exampleTranslation: "她承担了项目失败的全部责任。" },
    ],
  },
  attribute: {
    phonetic: "/əˈtrɪbjuːt/",
    meanings: [
      { partOfSpeech: "vt.", meaningZh: "归因于", isObscure: false, isHighFreq: true, exampleSentence: "The decline in crime can be attributed to improved economic conditions.", exampleTranslation: "犯罪率的下降可归因于经济条件的改善。" },
      { partOfSpeech: "n.", meaningZh: "属性；特征", isObscure: false, isHighFreq: false, exampleSentence: "Patience is an essential attribute for anyone working in scientific research.", exampleTranslation: "耐心是从事科学研究工作的人必备的品质。" },
    ],
  },

  // ==================== B ====================
  balance: {
    phonetic: "/ˈbæləns/",
    meanings: [
      { partOfSpeech: "n.", meaningZh: "平衡；均衡", isObscure: false, isHighFreq: false, exampleSentence: "The government must maintain a balance between economic growth and social welfare." },
      { partOfSpeech: "n.", meaningZh: "余额；结余", isObscure: true, isHighFreq: false, exampleSentence: "The account balance was much lower than expected at the end of the quarter." },
      { partOfSpeech: "vt.", meaningZh: "使平衡；权衡", isObscure: false, isHighFreq: false, exampleSentence: "Parents need to balance work commitments with family responsibilities." },
    ],
  },
  bias: {
    phonetic: "/ˈbaɪəs/",
    meanings: [
      { partOfSpeech: "n.", meaningZh: "偏见；偏向", isObscure: false, isHighFreq: false, exampleSentence: "The selection process must be free from gender and racial bias." },
      { partOfSpeech: "vt.", meaningZh: "使有偏见；使偏向", isObscure: true, isHighFreq: false, exampleSentence: "The funding model may bias researchers toward short-term projects." },
    ],
  },
  book: {
    phonetic: "/bʊk/",
    meanings: [
      { partOfSpeech: "n.", meaningZh: "书；书籍", isObscure: false, isHighFreq: false, exampleSentence: "Her latest book examines the relationship between technology and democracy." },
      { partOfSpeech: "vt.", meaningZh: "预订；预约", isObscure: true, isHighFreq: false, exampleSentence: "Tickets must be booked at least two weeks in advance." },
    ],
  },
  breed: {
    phonetic: "/briːd/",
    meanings: [
      { partOfSpeech: "vt.", meaningZh: "繁殖；饲养", isObscure: false, isHighFreq: false, exampleSentence: "The endangered species is being bred in captivity for eventual release." },
      { partOfSpeech: "vt.", meaningZh: "导致；滋生", isObscure: true, isHighFreq: true, exampleSentence: "Economic inequality can breed social unrest and political instability." },
    ],
  },
  budget: {
    phonetic: "/ˈbʌdʒɪt/",
    meanings: [
      { partOfSpeech: "n.", meaningZh: "预算", isObscure: false, isHighFreq: false, exampleSentence: "The research project was completed on time and within the allocated budget." },
      { partOfSpeech: "adj.", meaningZh: "廉价的；经济的", isObscure: true, isHighFreq: false, exampleSentence: "Budget airlines have made international travel accessible to more people." },
    ],
  },

  // ==================== C ====================
  capital: {
    phonetic: "/ˈkæpɪtl/",
    meanings: [
      { partOfSpeech: "n.", meaningZh: "首都；省会", isObscure: false, isHighFreq: false, exampleSentence: "Beijing is the political and cultural capital of China." },
      { partOfSpeech: "n.", meaningZh: "资本；资金", isObscure: false, isHighFreq: false, exampleSentence: "Venture capital has played a key role in financing technological innovation." },
      { partOfSpeech: "adj.", meaningZh: "大写的；死刑的", isObscure: true, isHighFreq: false, exampleSentence: "The defendant was convicted of a capital offense." },
    ],
  },
  channel: {
    phonetic: "/ˈtʃænl/",
    meanings: [
      { partOfSpeech: "n.", meaningZh: "频道；渠道", isObscure: false, isHighFreq: false, exampleSentence: "Social media has become an important channel for the dissemination of knowledge." },
      { partOfSpeech: "vt.", meaningZh: "引导；输送", isObscure: true, isHighFreq: false, exampleSentence: "The government plans to channel more resources into basic scientific research." },
    ],
  },
  climate: {
    phonetic: "/ˈklaɪmət/",
    meanings: [
      { partOfSpeech: "n.", meaningZh: "气候", isObscure: false, isHighFreq: false, exampleSentence: "Climate change is widely regarded as the most urgent environmental issue of our time." },
      { partOfSpeech: "n.", meaningZh: "风气；氛围", isObscure: true, isHighFreq: true, exampleSentence: "The intellectual climate of the university encouraged innovative thinking." },
    ],
  },
  complex: {
    phonetic: "/ˈkɒmpleks/",
    meanings: [
      { partOfSpeech: "adj.", meaningZh: "复杂的", isObscure: false, isHighFreq: false, exampleSentence: "The relationship between economic growth and environmental quality is highly complex." },
      { partOfSpeech: "n.", meaningZh: "综合体；建筑群", isObscure: true, isHighFreq: false, exampleSentence: "The new industrial complex will house several research laboratories." },
    ],
  },
  compromise: {
    phonetic: "/ˈkɒmprəmaɪz/",
    meanings: [
      { partOfSpeech: "n.", meaningZh: "妥协；折中", isObscure: false, isHighFreq: false, exampleSentence: "The agreement was reached through a series of difficult compromises." },
      { partOfSpeech: "vt.", meaningZh: "危及；损害", isObscure: true, isHighFreq: false, exampleSentence: "Cutting corners on safety could compromise the entire research project." },
    ],
  },
  conduct: {
    phonetic: "/kənˈdʌkt/",
    meanings: [
      { partOfSpeech: "vt.", meaningZh: "进行；实施", isObscure: false, isHighFreq: true, exampleSentence: "The survey was conducted among 2000 adults across the country." },
      { partOfSpeech: "n.", meaningZh: "行为；举止", isObscure: false, isHighFreq: false, exampleSentence: "The student's conduct during the experiment was exemplary." },
    ],
  },
  convert: {
    phonetic: "/kənˈvɜːt/",
    meanings: [
      { partOfSpeech: "vt.", meaningZh: "转换；转变", isObscure: false, isHighFreq: false, exampleSentence: "The factory converts raw materials into finished products with remarkable efficiency." },
      { partOfSpeech: "vt.", meaningZh: "使改变信仰", isObscure: true, isHighFreq: false, exampleSentence: "Missionaries attempted to convert the local population to Christianity." },
    ],
  },
  cover: {
    phonetic: "/ˈkʌvə(r)/",
    meanings: [
      { partOfSpeech: "vt.", meaningZh: "覆盖；遮盖", isObscure: false, isHighFreq: false, exampleSentence: "Snow covered the entire city overnight." },
      { partOfSpeech: "vt.", meaningZh: "报道；涉及", isObscure: false, isHighFreq: false, exampleSentence: "The course covers a wide range of topics in modern economic theory." },
      { partOfSpeech: "vt.", meaningZh: "支付；够付", isObscure: true, isHighFreq: false, exampleSentence: "The scholarship barely covers the cost of tuition and living expenses." },
    ],
  },
  critical: {
    phonetic: "/ˈkrɪtɪkl/",
    meanings: [
      { partOfSpeech: "adj.", meaningZh: "批评的；批判的", isObscure: false, isHighFreq: false, exampleSentence: "The report was highly critical of the government's handling of the crisis." },
      { partOfSpeech: "adj.", meaningZh: "关键的；至关重要的", isObscure: false, isHighFreq: true, exampleSentence: "Access to clean water is critical for public health in developing nations." },
    ],
  },
  cultivate: {
    phonetic: "/ˈkʌltɪveɪt/",
    meanings: [
      { partOfSpeech: "vt.", meaningZh: "耕作；种植", isObscure: false, isHighFreq: false, exampleSentence: "The land has been cultivated for rice production for centuries." },
      { partOfSpeech: "vt.", meaningZh: "培养；建立", isObscure: false, isHighFreq: false, exampleSentence: "Universities should cultivate students' critical thinking and creativity." },
    ],
  },
  currency: {
    phonetic: "/ˈkʌrənsi/",
    meanings: [
      { partOfSpeech: "n.", meaningZh: "货币", isObscure: false, isHighFreq: false, exampleSentence: "Fluctuations in currency exchange rates directly affect international trade." },
      { partOfSpeech: "n.", meaningZh: "流行；通用", isObscure: true, isHighFreq: false, exampleSentence: "The term has gained widespread currency in academic circles in recent years." },
    ],
  },

  // ==================== D ====================
  decline: {
    phonetic: "/dɪˈklaɪn/",
    meanings: [
      { partOfSpeech: "vi.", meaningZh: "下降；衰退", isObscure: false, isHighFreq: true, exampleSentence: "The decline of traditional manufacturing has had severe social consequences." },
      { partOfSpeech: "vt.", meaningZh: "婉拒；谢绝", isObscure: true, isHighFreq: false, exampleSentence: "She declined the invitation to speak at the conference due to prior commitments." },
      { partOfSpeech: "n.", meaningZh: "下降；减少", isObscure: false, isHighFreq: false, exampleSentence: "The study reports a sharp decline in insect populations worldwide." },
    ],
  },
  discipline: {
    phonetic: "/ˈdɪsəplɪn/",
    meanings: [
      { partOfSpeech: "n.", meaningZh: "纪律；自律", isObscure: false, isHighFreq: false, exampleSentence: "Academic success requires a high degree of self-discipline and perseverance." },
      { partOfSpeech: "n.", meaningZh: "学科；领域", isObscure: false, isHighFreq: true, exampleSentence: "Breakthroughs often occur at the intersection of different academic disciplines." },
    ],
  },
  dog: {
    phonetic: "/dɒɡ/",
    meanings: [
      { partOfSpeech: "n.", meaningZh: "狗；犬", isObscure: false, isHighFreq: false, exampleSentence: "The dog has been domesticated for thousands of years.", exampleTranslation: "狗已被驯化了数千年。" },
      { partOfSpeech: "vt.", meaningZh: "跟踪；尾随", isObscure: true, isHighFreq: false, exampleSentence: "Financial troubles continued to dog the company throughout the recession.", exampleTranslation: "在整个经济衰退期间，财务问题一直困扰着这家公司。" },
    ],
  },
  draft: {
    phonetic: "/drɑːft/",
    meanings: [
      { partOfSpeech: "n.", meaningZh: "草稿；草案", isObscure: false, isHighFreq: false, exampleSentence: "The committee is currently reviewing the draft of the new environmental protection law." },
      { partOfSpeech: "n.", meaningZh: "征兵；征召", isObscure: true, isHighFreq: false, exampleSentence: "The country reintroduced military draft during the national emergency." },
      { partOfSpeech: "vt.", meaningZh: "起草；草拟", isObscure: false, isHighFreq: false, exampleSentence: "A team of legal experts was assembled to draft the new regulations." },
    ],
  },

  // ==================== E ====================
  edge: {
    phonetic: "/edʒ/",
    meanings: [
      { partOfSpeech: "n.", meaningZh: "边缘；刀口", isObscure: false, isHighFreq: false, exampleSentence: "The company built its headquarters on the edge of the city." },
      { partOfSpeech: "n.", meaningZh: "优势；竞争力", isObscure: true, isHighFreq: false, exampleSentence: "Early adoption of new technology gave the firm a competitive edge over its rivals." },
    ],
  },
  engage: {
    phonetic: "/ɪnˈɡeɪdʒ/",
    meanings: [
      { partOfSpeech: "vt.", meaningZh: "吸引；使参与", isObscure: false, isHighFreq: false, exampleSentence: "The new teaching method was designed to better engage students in the learning process." },
      { partOfSpeech: "vi.", meaningZh: "从事；参与", isObscure: false, isHighFreq: false, exampleSentence: "An increasing number of students engage in part-time work during their studies." },
    ],
  },
  exercise: {
    phonetic: "/ˈeksəsaɪz/",
    meanings: [
      { partOfSpeech: "n.", meaningZh: "锻炼；运动", isObscure: false, isHighFreq: false, exampleSentence: "Regular physical exercise has been shown to improve mental health outcomes." },
      { partOfSpeech: "vt.", meaningZh: "行使；运用（权力/权利）", isObscure: true, isHighFreq: true, exampleSentence: "Citizens have the right to exercise their vote in free and fair elections." },
    ],
  },
  exploit: {
    phonetic: "/ɪkˈsplɔɪt/",
    meanings: [
      { partOfSpeech: "vt.", meaningZh: "剥削；利用", isObscure: false, isHighFreq: false, exampleSentence: "The company was criticized for exploiting workers in developing countries." },
      { partOfSpeech: "vt.", meaningZh: "开发；开采", isObscure: false, isHighFreq: false, exampleSentence: "New technologies are being developed to exploit renewable energy sources more efficiently." },
    ],
  },

  // ==================== F ====================
  fashion: {
    phonetic: "/ˈfæʃn/",
    meanings: [
      { partOfSpeech: "n.", meaningZh: "时尚；时装", isObscure: false, isHighFreq: false, exampleSentence: "The fashion industry is one of the largest contributors to global pollution." },
      { partOfSpeech: "n.", meaningZh: "方式；样子", isObscure: true, isHighFreq: false, exampleSentence: "The problem was solved in a surprisingly simple fashion." },
    ],
  },
  figure: {
    phonetic: "/ˈfɪɡə(r)/",
    meanings: [
      { partOfSpeech: "n.", meaningZh: "数字；数据", isObscure: false, isHighFreq: false, exampleSentence: "Official figures show that unemployment has fallen to a record low." },
      { partOfSpeech: "n.", meaningZh: "人物；人士", isObscure: false, isHighFreq: false, exampleSentence: "He is one of the most influential figures in modern economics." },
      { partOfSpeech: "vt.", meaningZh: "认为；推测", isObscure: true, isHighFreq: false, exampleSentence: "I figure it will take at least three years to complete the project." },
    ],
  },
  fine: {
    phonetic: "/faɪn/",
    meanings: [
      { partOfSpeech: "adj.", meaningZh: "好的；晴朗的", isObscure: false, isHighFreq: false, exampleSentence: "The weather was fine, so the outdoor ceremony proceeded as planned." },
      { partOfSpeech: "adj.", meaningZh: "精细的；细微的", isObscure: true, isHighFreq: false, exampleSentence: "There is a fine line between confidence and arrogance." },
      { partOfSpeech: "n.", meaningZh: "罚款", isObscure: true, isHighFreq: false, exampleSentence: "Drivers who exceed the speed limit face heavy fines." },
    ],
  },
  fuel: {
    phonetic: "/ˈfjuːəl/",
    meanings: [
      { partOfSpeech: "n.", meaningZh: "燃料", isObscure: false, isHighFreq: false, exampleSentence: "Fossil fuels remain the dominant source of energy worldwide." },
      { partOfSpeech: "vt.", meaningZh: "加剧；刺激", isObscure: true, isHighFreq: true, exampleSentence: "The rapid expansion of credit has fueled a housing market bubble." },
    ],
  },

  // ==================== G ====================
  grant: {
    phonetic: "/ɡrɑːnt/",
    meanings: [
      { partOfSpeech: "vt.", meaningZh: "授予；给予", isObscure: false, isHighFreq: false, exampleSentence: "The patent was granted after a thorough review of the application." },
      { partOfSpeech: "n.", meaningZh: "拨款；补助金", isObscure: false, isHighFreq: false, exampleSentence: "The university received a substantial grant to establish a new research center." },
      { partOfSpeech: "vt.", meaningZh: "承认（属实）", isObscure: true, isHighFreq: true, exampleSentence: "I grant you that the plan has its flaws, but it remains the best option available." },
    ],
  },
  gross: {
    phonetic: "/ɡrəʊs/",
    meanings: [
      { partOfSpeech: "adj.", meaningZh: "总的；毛的", isObscure: false, isHighFreq: true, exampleSentence: "The country's gross domestic product grew by three percent last year." },
      { partOfSpeech: "adj.", meaningZh: "令人恶心的；粗俗的", isObscure: true, isHighFreq: false, exampleSentence: "The conditions in the factory were described as gross violations of human rights." },
    ],
  },

  // ==================== H ====================
  humble: {
    phonetic: "/ˈhʌmbl/",
    meanings: [
      { partOfSpeech: "adj.", meaningZh: "谦虚的；谦逊的", isObscure: false, isHighFreq: false, exampleSentence: "Despite his fame, the scientist remained remarkably humble about his achievements." },
      { partOfSpeech: "adj.", meaningZh: "出身卑微的；低下的", isObscure: true, isHighFreq: false, exampleSentence: "His rise from humble beginnings to international prominence is truly inspiring." },
    ],
  },

  // ==================== I ====================
  industry: {
    phonetic: "/ˈɪndəstri/",
    meanings: [
      { partOfSpeech: "n.", meaningZh: "工业；产业", isObscure: false, isHighFreq: false, exampleSentence: "The automobile industry is undergoing a fundamental transformation." },
      { partOfSpeech: "n.", meaningZh: "勤奋；勤劳", isObscure: true, isHighFreq: true, exampleSentence: "Her success was built on years of hard work and industry." },
    ],
  },
  interest: {
    phonetic: "/ˈɪntrəst/",
    meanings: [
      { partOfSpeech: "n.", meaningZh: "兴趣；关注", isObscure: false, isHighFreq: false, exampleSentence: "There has been growing interest in renewable energy technologies." },
      { partOfSpeech: "n.", meaningZh: "利息", isObscure: false, isHighFreq: false, exampleSentence: "The central bank has cut interest rates to stimulate economic growth." },
      { partOfSpeech: "n.", meaningZh: "利益；利害关系", isObscure: false, isHighFreq: false, exampleSentence: "The decision was made in the best interests of the community." },
    ],
  },
  issue: {
    phonetic: "/ˈɪʃuː/",
    meanings: [
      { partOfSpeech: "n.", meaningZh: "问题；议题", isObscure: false, isHighFreq: false, exampleSentence: "The most pressing issue facing policymakers today is the aging population." },
      { partOfSpeech: "vt.", meaningZh: "发布；颁发", isObscure: true, isHighFreq: false, exampleSentence: "The government is expected to issue new guidelines on data privacy next month." },
    ],
  },

  // ==================== M ====================
  mean: {
    phonetic: "/miːn/",
    meanings: [
      { partOfSpeech: "vt.", meaningZh: "意思是；意味着", isObscure: false, isHighFreq: false, exampleSentence: "What exactly does the author mean by 'cognitive dissonance'?" },
      { partOfSpeech: "adj.", meaningZh: "吝啬的；刻薄的", isObscure: true, isHighFreq: false, exampleSentence: "It was mean of him to blame his colleagues for his own mistakes." },
      { partOfSpeech: "adj.", meaningZh: "平均的", isObscure: false, isHighFreq: false, exampleSentence: "The mean temperature in July reached a record high." },
      { partOfSpeech: "n.", meaningZh: "平均值", isObscure: false, isHighFreq: false, exampleSentence: "The mean of the sample was significantly higher than expected." },
    ],
  },
  moderate: {
    phonetic: "/ˈmɒdərət/",
    meanings: [
      { partOfSpeech: "adj.", meaningZh: "适度的；温和的", isObscure: false, isHighFreq: false, exampleSentence: "Moderate exercise has been linked to better cognitive function in old age." },
      { partOfSpeech: "vt.", meaningZh: "缓和；调节", isObscure: true, isHighFreq: true, exampleSentence: "The government intervened to moderate the sharp rise in housing prices." },
    ],
  },

  // ==================== N ====================
  novel: {
    phonetic: "/ˈnɒvl/",
    meanings: [
      { partOfSpeech: "n.", meaningZh: "小说", isObscure: false, isHighFreq: false, exampleSentence: "Her debut novel won several prestigious literary awards." },
      { partOfSpeech: "adj.", meaningZh: "新颖的；新奇的", isObscure: true, isHighFreq: true, exampleSentence: "The researchers proposed a novel approach to solving the problem." },
    ],
  },

  // ==================== O ====================
  objective: {
    phonetic: "/əbˈdʒektɪv/",
    meanings: [
      { partOfSpeech: "n.", meaningZh: "目标；目的", isObscure: false, isHighFreq: false, exampleSentence: "The primary objective of the reform is to reduce inequality in access to education." },
      { partOfSpeech: "adj.", meaningZh: "客观的", isObscure: false, isHighFreq: true, exampleSentence: "It is difficult to remain completely objective when evaluating one's own work." },
    ],
  },

  // ==================== P ====================
  panel: {
    phonetic: "/ˈpænl/",
    meanings: [
      { partOfSpeech: "n.", meaningZh: "面板；仪表盘", isObscure: false, isHighFreq: false, exampleSentence: "The control panel allows operators to monitor all systems simultaneously." },
      { partOfSpeech: "n.", meaningZh: "专家小组", isObscure: false, isHighFreq: false, exampleSentence: "An independent panel of experts reviewed the findings before publication." },
    ],
  },
  picture: {
    phonetic: "/ˈpɪktʃə(r)/",
    meanings: [
      { partOfSpeech: "n.", meaningZh: "图片；照片", isObscure: false, isHighFreq: false, exampleSentence: "The picture on the front page captured the devastating impact of the earthquake." },
      { partOfSpeech: "n.", meaningZh: "局面；状况", isObscure: true, isHighFreq: false, exampleSentence: "The latest economic data paints a worrying picture of rising inflation." },
    ],
  },
  plant: {
    phonetic: "/plɑːnt/",
    meanings: [
      { partOfSpeech: "n.", meaningZh: "植物", isObscure: false, isHighFreq: false, exampleSentence: "Many plant species are threatened by deforestation and climate change." },
      { partOfSpeech: "n.", meaningZh: "工厂；车间", isObscure: false, isHighFreq: false, exampleSentence: "The manufacturing plant employs over 3000 workers in the region." },
      { partOfSpeech: "vt.", meaningZh: "种植；安放", isObscure: true, isHighFreq: false, exampleSentence: "Evidence was planted at the scene to frame the suspect." },
    ],
  },
  produce: {
    phonetic: "/prəˈdjuːs/",
    meanings: [
      { partOfSpeech: "vt.", meaningZh: "生产；制造", isObscure: false, isHighFreq: false, exampleSentence: "The factory produces over one million units annually." },
      { partOfSpeech: "vt.", meaningZh: "引起；导致", isObscure: false, isHighFreq: true, exampleSentence: "The new policy is expected to produce significant improvements in air quality." },
      { partOfSpeech: "n.", meaningZh: "农产品", isObscure: true, isHighFreq: false, exampleSentence: "Local farmers sell fresh produce at the weekly market." },
    ],
  },
  project: {
    phonetic: "/ˈprɒdʒekt/",
    meanings: [
      { partOfSpeech: "n.", meaningZh: "项目；工程", isObscure: false, isHighFreq: false, exampleSentence: "The research project was funded by the National Science Foundation." },
      { partOfSpeech: "vt.", meaningZh: "预测；预计", isObscure: true, isHighFreq: true, exampleSentence: "The company projects a 15 percent increase in revenue for the coming year." },
    ],
  },

  // ==================== R ====================
  rate: {
    phonetic: "/reɪt/",
    meanings: [
      { partOfSpeech: "n.", meaningZh: "比率；率", isObscure: false, isHighFreq: false, exampleSentence: "The unemployment rate fell to its lowest level in three decades." },
      { partOfSpeech: "vt.", meaningZh: "评价；评定", isObscure: true, isHighFreq: false, exampleSentence: "The product was rated highly by independent consumer testing agencies." },
    ],
  },
  remain: {
    phonetic: "/rɪˈmeɪn/",
    meanings: [
      { partOfSpeech: "vi.", meaningZh: "保持；仍然是", isObscure: false, isHighFreq: false, exampleSentence: "Despite decades of research, the cause of the disease remains unknown." },
      { partOfSpeech: "vi.", meaningZh: "留下；剩余", isObscure: false, isHighFreq: false, exampleSentence: "Only a few hundred of the species remain in the wild." },
    ],
  },
  remedy: {
    phonetic: "/ˈremədi/",
    meanings: [
      { partOfSpeech: "n.", meaningZh: "补救办法；疗法", isObscure: false, isHighFreq: false, exampleSentence: "There is no simple remedy for the deep-seated problems in the education system." },
      { partOfSpeech: "vt.", meaningZh: "补救；纠正", isObscure: false, isHighFreq: false, exampleSentence: "The government has introduced measures to remedy the housing shortage." },
    ],
  },

  // ==================== S ====================
  scale: {
    phonetic: "/skeɪl/",
    meanings: [
      { partOfSpeech: "n.", meaningZh: "规模；范围", isObscure: false, isHighFreq: false, exampleSentence: "The scale of the disaster was far greater than initial estimates suggested." },
      { partOfSpeech: "n.", meaningZh: "等级；级别", isObscure: false, isHighFreq: false, exampleSentence: "Participants were asked to rate their satisfaction on a scale of one to ten." },
    ],
  },
  scheme: {
    phonetic: "/skiːm/",
    meanings: [
      { partOfSpeech: "n.", meaningZh: "计划；方案", isObscure: false, isHighFreq: false, exampleSentence: "A new subsidy scheme has been launched to encourage the adoption of electric vehicles." },
      { partOfSpeech: "n.", meaningZh: "阴谋；诡计", isObscure: true, isHighFreq: false, exampleSentence: "The investigation uncovered a scheme to defraud investors of millions of dollars." },
    ],
  },
  shape: {
    phonetic: "/ʃeɪp/",
    meanings: [
      { partOfSpeech: "n.", meaningZh: "形状；外形", isObscure: false, isHighFreq: false, exampleSentence: "The building's unusual shape has made it a local landmark." },
      { partOfSpeech: "vt.", meaningZh: "塑造；决定", isObscure: false, isHighFreq: false, exampleSentence: "Childhood experiences play a crucial role in shaping adult personality." },
    ],
  },
  solid: {
    phonetic: "/ˈsɒlɪd/",
    meanings: [
      { partOfSpeech: "adj.", meaningZh: "固体的；坚实的", isObscure: false, isHighFreq: false, exampleSentence: "The bridge is built on solid rock foundations." },
      { partOfSpeech: "adj.", meaningZh: "可靠的；可信赖的", isObscure: true, isHighFreq: false, exampleSentence: "The study provides solid evidence for the link between diet and health." },
    ],
  },
  sound: {
    phonetic: "/saʊnd/",
    meanings: [
      { partOfSpeech: "n.", meaningZh: "声音；声响", isObscure: false, isHighFreq: false, exampleSentence: "The sound of traffic can be heard from miles away." },
      { partOfSpeech: "adj.", meaningZh: "合理的；健全的", isObscure: true, isHighFreq: false, exampleSentence: "The proposal is built on sound economic principles." },
    ],
  },
  state: {
    phonetic: "/steɪt/",
    meanings: [
      { partOfSpeech: "n.", meaningZh: "状态；状况", isObscure: false, isHighFreq: false, exampleSentence: "The country is in a state of economic crisis." },
      { partOfSpeech: "n.", meaningZh: "国家；州", isObscure: false, isHighFreq: false, exampleSentence: "Individual states have the right to set their own education policy." },
      { partOfSpeech: "vt.", meaningZh: "陈述；说明", isObscure: true, isHighFreq: true, exampleSentence: "The report clearly states that more research is needed before any conclusions can be drawn." },
    ],
  },
  subject: {
    phonetic: "/ˈsʌbdʒɪkt/",
    meanings: [
      { partOfSpeech: "n.", meaningZh: "主题；科目", isObscure: false, isHighFreq: false, exampleSentence: "The subject of climate change has dominated public discourse in recent years." },
      { partOfSpeech: "n.", meaningZh: "实验对象；研究对象", isObscure: true, isHighFreq: false, exampleSentence: "The subjects were randomly assigned to either the treatment or control group." },
      { partOfSpeech: "adj.", meaningZh: "受…支配的；取决于", isObscure: true, isHighFreq: false, exampleSentence: "The schedule is subject to change without prior notice." },
    ],
  },
  sustain: {
    phonetic: "/səˈsteɪn/",
    meanings: [
      { partOfSpeech: "vt.", meaningZh: "维持；保持", isObscure: false, isHighFreq: false, exampleSentence: "The economy has sustained steady growth for over a decade." },
      { partOfSpeech: "vt.", meaningZh: "遭受；承受", isObscure: true, isHighFreq: true, exampleSentence: "The company sustained heavy losses during the financial crisis." },
    ],
  },

  // ==================== T ====================
  table: {
    phonetic: "/ˈteɪbl/",
    meanings: [
      { partOfSpeech: "n.", meaningZh: "桌子；台子", isObscure: false, isHighFreq: false, exampleSentence: "The documents were spread across the conference table." },
      { partOfSpeech: "n.", meaningZh: "表格；一览表", isObscure: false, isHighFreq: false, exampleSentence: "Table 3 summarizes the main findings of the study." },
      { partOfSpeech: "vt.", meaningZh: "搁置（议题）；提出", isObscure: true, isHighFreq: true, exampleSentence: "The committee decided to table the proposal until more data became available." },
    ],
  },
  treat: {
    phonetic: "/triːt/",
    meanings: [
      { partOfSpeech: "vt.", meaningZh: "对待；看待", isObscure: false, isHighFreq: false, exampleSentence: "All participants were treated with equal respect throughout the study." },
      { partOfSpeech: "vt.", meaningZh: "治疗；处理", isObscure: false, isHighFreq: false, exampleSentence: "The disease can be treated effectively if diagnosed early enough." },
    ],
  },

  // ==================== V ====================
  vessel: {
    phonetic: "/ˈvesl/",
    meanings: [
      { partOfSpeech: "n.", meaningZh: "船只；舰船", isObscure: false, isHighFreq: false, exampleSentence: "The fishing vessel was reported missing after a severe storm." },
      { partOfSpeech: "n.", meaningZh: "容器；器皿", isObscure: false, isHighFreq: false, exampleSentence: "Ancient pottery vessels were discovered at the archaeological site." },
      { partOfSpeech: "n.", meaningZh: "血管", isObscure: true, isHighFreq: false, exampleSentence: "The drug works by dilating blood vessels to improve circulation." },
    ],
  },

  // ==================== W ====================
  weather: {
    phonetic: "/ˈweðə(r)/",
    meanings: [
      { partOfSpeech: "n.", meaningZh: "天气；气象", isObscure: false, isHighFreq: false, exampleSentence: "Extreme weather events have become more frequent due to climate change." },
      { partOfSpeech: "vt.", meaningZh: "经受住；渡过（困难）", isObscure: true, isHighFreq: true, exampleSentence: "The company managed to weather the economic downturn without major layoffs." },
    ],
  },
  yield: {
    phonetic: "/jiːld/",
    meanings: [
      { partOfSpeech: "vt.", meaningZh: "产生；产出", isObscure: false, isHighFreq: true, exampleSentence: "The investigation yielded valuable information about the causes of the outbreak." },
      { partOfSpeech: "n.", meaningZh: "产量；收益", isObscure: false, isHighFreq: false, exampleSentence: "Crop yields have increased significantly thanks to modern farming techniques." },
      { partOfSpeech: "vi.", meaningZh: "屈服；让步", isObscure: true, isHighFreq: true, exampleSentence: "The government refused to yield to pressure from the opposition." },
    ],
  },
};

/** 从列表生成义项 */
export function getKaoyanEntry(word: string): LocalWordFullEntry | undefined {
  return KAOYAN_WORD_MAP[word.toLowerCase().trim()];
}
