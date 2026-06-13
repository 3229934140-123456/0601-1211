import type {
  Survey,
  UserContext,
  ButtonTexts,
  SDKConfig,
} from '../src/types';
import { SurveySDK } from '../src/index';

const sampleSurvey: Survey = {
  meta: {
    id: 'demo_survey',
    title: '员工满意度调研',
  },
  questions: [],
};

console.log('=== SurveySDK 使用指南 ===\n');

console.log('1. 初始化 SDK:');
console.log(`
const sdk = SurveySDK.create(sampleSurvey, {
  autoSave: true,
  autoSaveInterval: 30000,
  submitUrl: '/api/survey/submit',
  renderConfig: {
    showProgress: true,
    showQuestionIndex: true,
    buttonTexts: {
      prev: '上一题',
      next: '下一题',
      submit: '提交',
    },
  },
});
`);

console.log('2. 设置用户标识（提交时必须）:');
console.log(`
const user: UserContext = {
  userId: 'EMP_001',
  username: '张三',
  department: '研发部',
};
sdk.setUser(user);
`);

console.log('3. 挂载到 DOM:');
console.log(`
sdk.mount('#survey-container');
`);

console.log('4. 监听事件:');
console.log(`
const offComplete = sdk.on('complete', ({ answers, summary, result }) => {
  console.log('完成率:', Math.round(summary.completionRate * 100) + '%');
  console.log('提交ID:', result.submissionId);
});

const offError = sdk.on('validateError', ({ questionId, errorMessage }) => {
  console.warn('校验错误:', errorMessage);
});
`);

console.log('5. 调用方法:');
console.log(`
// 手动导航
sdk.next();
sdk.prev();
sdk.goToQuestion('q_id_001');

// 答案管理
sdk.setAnswer('q_id_001', 5);
sdk.getAnswers();

// 统计
sdk.getCompletionRate();       // 完成率
sdk.getAverageScore();         // 平均得分
sdk.getQuestionAverageScore('q_id_rating'); // 单题平均分
sdk.getAllStatistics();        // 所有题目统计
sdk.getResultSummary();        // 结果摘要

// 进度
sdk.saveDraft();               // 保存草稿
sdk.loadDraft();               // 加载草稿
sdk.clearDraft();              // 清除草稿

// 提交
await sdk.submit();            // 提交问卷

// 重置
sdk.restart();
`);

console.log('6. 自定义按钮文案:');
console.log(`
const customButtons: ButtonTexts = {
  prev: '← 返回',
  next: '继续 →',
  submit: '✅ 确认提交',
  restart: '🔄 再填一次',
  saveDraft: '💾 稍后继续',
};
sdk.setButtonTexts(customButtons);
`);

console.log('7. 卸载销毁:');
console.log(`
sdk.unmount();    // 只卸载渲染
sdk.destroy();    // 完全销毁，移除所有事件监听
`);

const dummySdk = new SurveySDK(sampleSurvey);
console.log('\n=== 类型检查通过 ===');
console.log('getStatus:', dummySdk.getStatus());
console.log('getTotalQuestions:', dummySdk.getTotalQuestions());
