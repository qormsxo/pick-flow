import { DynamicModule, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AiProvider } from './ai-provider.interface';
import { AI_PROVIDER } from './ai.constants';
import { FakeAiProvider } from './fake-ai.provider';
import { GeminiProvider } from './gemini-ai.provider';

@Module({})
export class AiModule {
  /**
   * AI_PROVIDER 환경 변수로 구현을 고른다.
   * 호출부(취향 해석, 임베딩 워커)는 AI_PROVIDER 토큰만 주입받는다.
   */
  static register(): DynamicModule {
    return {
      module: AiModule,
      global: true,
      providers: [
        {
          provide: AI_PROVIDER,
          inject: [ConfigService],
          useFactory: (config: ConfigService): AiProvider => {
            const provider = config.get<string>('ai.provider');

            if (provider === 'gemini') return new GeminiProvider(config);

            return new FakeAiProvider(config);
          },
        },
      ],
      exports: [AI_PROVIDER],
    };
  }
}
