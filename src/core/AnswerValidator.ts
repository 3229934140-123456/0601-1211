import type {
  Question,
  Answer,
  AnswerValue,
  AnswersMap,
  ValidationResult,
  SingleChoiceQuestion,
  MultipleChoiceQuestion,
  RatingQuestion,
  TextQuestion,
} from '../types';

export class AnswerValidator {
  validateQuestion(
    question: Question,
    answer: Answer | undefined
  ): ValidationResult {
    if (!question.required && !answer) {
      return { valid: true };
    }

    if (question.required && !this.hasAnswer(answer)) {
      return {
        valid: false,
        questionId: question.id,
        errorMessage: `"${question.title}" 为必填项`,
        invalidQuestionIds: [question.id],
      };
    }

    if (!answer && !question.required) {
      return { valid: true };
    }

    switch (question.type) {
      case 'single':
        return this.validateSingleChoice(question, answer);
      case 'multiple':
        return this.validateMultipleChoice(question, answer);
      case 'rating':
        return this.validateRating(question, answer);
      case 'text':
        return this.validateText(question, answer);
      default:
        return { valid: true };
    }
  }

  validateAll(
    questions: Question[],
    answers: AnswersMap
  ): ValidationResult {
    const invalidIds: string[] = [];
    let firstErrorMessage = '';
    let firstErrorId = '';

    for (const question of questions) {
      const answer = answers[question.id];
      const result = this.validateQuestion(question, answer);
      if (!result.valid) {
        invalidIds.push(question.id);
        if (!firstErrorMessage) {
          firstErrorMessage = result.errorMessage || '存在必填项未填写';
          firstErrorId = question.id;
        }
      }
    }

    if (invalidIds.length > 0) {
      return {
        valid: false,
        questionId: firstErrorId,
        errorMessage: firstErrorMessage,
        invalidQuestionIds: invalidIds,
      };
    }

    return { valid: true };
  }

  listInvalid(
    questions: Question[],
    answers: AnswersMap
  ): string[] {
    const result = this.validateAll(questions, answers);
    return result.invalidQuestionIds || [];
  }

  private hasAnswer(answer: Answer | undefined): boolean {
    if (!answer || answer.value === null || answer.value === undefined) {
      return false;
    }
    if (Array.isArray(answer.value)) {
      return answer.value.length > 0;
    }
    if (typeof answer.value === 'string') {
      return answer.value.trim().length > 0;
    }
    return true;
  }

  private validateSingleChoice(
    question: SingleChoiceQuestion,
    answer: Answer | undefined
  ): ValidationResult {
    if (!answer || answer.value === null || answer.value === undefined) {
      return { valid: true };
    }
    const validValues = question.options.map((o) =>
      typeof o.value === 'number' ? o.value : String(o.value)
    );
    const val =
      typeof answer.value === 'number'
        ? answer.value
        : String(answer.value);
    if (!validValues.includes(val)) {
      return {
        valid: false,
        questionId: question.id,
        errorMessage: `"${question.title}" 的选项无效`,
        invalidQuestionIds: [question.id],
      };
    }
    return { valid: true };
  }

  private validateMultipleChoice(
    question: MultipleChoiceQuestion,
    answer: Answer | undefined
  ): ValidationResult {
    if (!answer || answer.value === null || answer.value === undefined) {
      return { valid: true };
    }
    if (!Array.isArray(answer.value)) {
      return {
        valid: false,
        questionId: question.id,
        errorMessage: `"${question.title}" 的答案格式错误`,
        invalidQuestionIds: [question.id],
      };
    }

    const values = answer.value;
    if (question.minSelect && values.length < question.minSelect) {
      return {
        valid: false,
        questionId: question.id,
        errorMessage: `"${question.title}" 至少选择 ${question.minSelect} 项`,
        invalidQuestionIds: [question.id],
      };
    }
    if (question.maxSelect && values.length > question.maxSelect) {
      return {
        valid: false,
        questionId: question.id,
        errorMessage: `"${question.title}" 最多选择 ${question.maxSelect} 项`,
        invalidQuestionIds: [question.id],
      };
    }

    const validValues = question.options.map((o) =>
      typeof o.value === 'number' ? o.value : String(o.value)
    );
    for (const v of values) {
      const normalized = typeof v === 'number' ? v : String(v);
      if (!validValues.includes(normalized)) {
        return {
          valid: false,
          questionId: question.id,
          errorMessage: `"${question.title}" 包含无效选项`,
          invalidQuestionIds: [question.id],
        };
      }
    }
    return { valid: true };
  }

  private validateRating(
    question: RatingQuestion,
    answer: Answer | undefined
  ): ValidationResult {
    if (!answer || answer.value === null || answer.value === undefined) {
      return { valid: true };
    }
    const value = Number(answer.value);
    if (isNaN(value)) {
      return {
        valid: false,
        questionId: question.id,
        errorMessage: `"${question.title}" 的分数无效`,
        invalidQuestionIds: [question.id],
      };
    }
    if (value < question.minValue || value > question.maxValue) {
      return {
        valid: false,
        questionId: question.id,
        errorMessage: `"${question.title}" 的分数应在 ${question.minValue} - ${question.maxValue} 之间`,
        invalidQuestionIds: [question.id],
      };
    }
    if (question.step) {
      const normalized = (value - question.minValue) / question.step;
      if (!Number.isInteger(normalized)) {
        return {
          valid: false,
          questionId: question.id,
          errorMessage: `"${question.title}" 的分数步长无效`,
          invalidQuestionIds: [question.id],
        };
      }
    }
    return { valid: true };
  }

  private validateText(
    question: TextQuestion,
    answer: Answer | undefined
  ): ValidationResult {
    if (!answer || answer.value === null || answer.value === undefined) {
      return { valid: true };
    }
    const text = String(answer.value);
    if (question.maxLength && text.length > question.maxLength) {
      return {
        valid: false,
        questionId: question.id,
        errorMessage: `"${question.title}" 最多 ${question.maxLength} 个字符`,
        invalidQuestionIds: [question.id],
      };
    }
    if (question.minLength && text.trim().length < question.minLength) {
      return {
        valid: false,
        questionId: question.id,
        errorMessage: `"${question.title}" 至少 ${question.minLength} 个字符`,
        invalidQuestionIds: [question.id],
      };
    }
    return { valid: true };
  }
}
