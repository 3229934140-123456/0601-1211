import type {
  SubmitPayload,
  SubmitResult,
  UserContext,
} from '../types';

export interface SubmitAdapter {
  submit(payload: SubmitPayload): Promise<SubmitResult>;
}

export class DefaultSubmitAdapter implements SubmitAdapter {
  private submitUrl?: string;
  private mockDelay: number;

  constructor(submitUrl?: string, mockDelay: number = 500) {
    this.submitUrl = submitUrl;
    this.mockDelay = mockDelay;
  }

  async submit(payload: SubmitPayload): Promise<SubmitResult> {
    if (this.submitUrl) {
      return this.submitToServer(payload);
    }
    return this.mockSubmit(payload);
  }

  private async submitToServer(
    payload: SubmitPayload
  ): Promise<SubmitResult> {
    try {
      const response = await fetch(this.submitUrl!, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json().catch(() => ({}));
      return {
        success: true,
        submissionId: data.submissionId || `sub_${Date.now()}`,
        message: data.message || '提交成功',
        timestamp: Date.now(),
      };
    } catch (e) {
      throw e as Error;
    }
  }

  private async mockSubmit(
    payload: SubmitPayload
  ): Promise<SubmitResult> {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          success: true,
          submissionId: `sub_${Date.now()}_${Math.random()
            .toString(36)
            .replace(/\./g, '')
            .substring(2, 10)}`,
          message: '问卷提交成功，感谢您的反馈！',
          timestamp: Date.now(),
        });
      }, this.mockDelay);
    });
  }
}
