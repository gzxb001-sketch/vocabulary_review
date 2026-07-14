// 游客模式 demo 词库
// 用户无需登录即可体验核心复习流程

export type DemoReviewItem = {
  wordId: string;
  displayText: string;
  meaningZh: string;
  phonetic: string;
  partOfSpeech: string;
  exampleSentence: string;
  sourceType: string;
  sourceNote: string;
  meanings: {
    partOfSpeech: string;
    meaningZh: string;
    exampleSentence?: string;
    exampleTranslation?: string;
    isObscure: boolean;
    isHighFreq: boolean;
  }[];
};

export const DEMO_WORDS: DemoReviewItem[] = [
  {
    wordId: "demo_abandon",
    displayText: "abandon",
    meaningZh: "放弃；抛弃",
    phonetic: "/əˈbændən/",
    partOfSpeech: "v.",
    exampleSentence:
      "Researchers have increasingly abandoned traditional methods in favor of computational approaches.",
    sourceType: "exam",
    sourceNote: "考研真题高频词",
    meanings: [
      {
        partOfSpeech: "v.",
        meaningZh: "放弃；抛弃",
        exampleSentence:
          "The study abandons the assumption that all participants share the same baseline.",
        exampleTranslation: "该研究放弃了所有参与者共享同一基线的假设。",
        isObscure: false,
        isHighFreq: true,
      },
      {
        partOfSpeech: "n.",
        meaningZh: "放任；放纵",
        exampleSentence:
          "He drove with reckless abandon, ignoring every warning sign.",
        exampleTranslation: "他肆意驾驶，无视每一个警示标志。",
        isObscure: true,
        isHighFreq: false,
      },
    ],
  },
  {
    wordId: "demo_derive",
    displayText: "derive",
    meaningZh: "源自；获得",
    phonetic: "/dɪˈraɪv/",
    partOfSpeech: "v.",
    exampleSentence:
      "Economists have long derived key insights from cross-country data comparisons.",
    sourceType: "reading",
    sourceNote: "学术阅读高频词",
    meanings: [
      {
        partOfSpeech: "v.",
        meaningZh: "源自；从…中得到",
        exampleSentence:
          "Most academic terms derive from Latin or Greek roots.",
        exampleTranslation: "大多数学术术语源自拉丁语或希腊语词根。",
        isObscure: false,
        isHighFreq: true,
      },
      {
        partOfSpeech: "v.",
        meaningZh: "推导；演绎出",
        exampleSentence:
          "From these data we can derive several important conclusions.",
        exampleTranslation: "从这些数据中我们可以推导出几个重要结论。",
        isObscure: false,
        isHighFreq: false,
      },
    ],
  },
  {
    wordId: "demo_compulsory",
    displayText: "compulsory",
    meaningZh: "强制的；必修的",
    phonetic: "/kəmˈpʌlsəri/",
    partOfSpeech: "adj.",
    exampleSentence:
      "Compulsory education has been a defining feature of modern societies.",
    sourceType: "lecture",
    sourceNote: "听课记录高频词",
    meanings: [
      {
        partOfSpeech: "adj.",
        meaningZh: "强制的；义务的",
        exampleSentence:
          "The course is compulsory for all first-year students.",
        exampleTranslation: "这门课对所有大一学生是必修的。",
        isObscure: false,
        isHighFreq: true,
      },
      {
        partOfSpeech: "adj.",
        meaningZh: "必修的（课程）",
        exampleSentence:
          "English is a compulsory subject in most Chinese high schools.",
        exampleTranslation: "英语在中国大多数高中是必修科目。",
        isObscure: false,
        isHighFreq: false,
      },
    ],
  },
];
