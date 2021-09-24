import { Test, TestingModule } from '@nestjs/testing';
import { Injectable, Module } from '@nestjs/common';
import { DiscordModule, Once, On, DiscordClientProvider } from '../packages';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Guild, Message } from 'discord.js';

describe('On event', () => {
  it('Function marked with "Once" decorator with { event: \'ready\' } args must be called at startup', async () => {
    await new Promise(async (resolve) => {
      let moduleRef: TestingModule;

      @Injectable()
      class CommandBotGateway {
        @Once({ event: 'ready' })
        async onReady() {
          await moduleRef.close();
          resolve({});
        }
      }

      @Module({
        imports: [
          ConfigModule.forRoot({
            envFilePath: './test/.test.env',
          }),
          DiscordModule.forRootAsync({
            imports: [ConfigModule],
            useFactory: (configService: ConfigService) => ({
              intents: [],
              token: configService.get('TOKEN') || process.env.TOKEN,
              commandPrefix:
                configService.get('COMMAND_PREFIX') ||
                process.env.COMMAND_PREFIX,
            }),
            inject: [ConfigService],
          }),
        ],
        providers: [CommandBotGateway],
      })
      class CommandBotModule {}

      moduleRef = await Test.createTestingModule({
        imports: [CommandBotModule],
      }).compile();
      await moduleRef.init();
    });
  });

  it('Function marked with "On" decorator with { event: \'messageCreate\' } args must be called on "messageCreate" event', async () => {
    const testingGuildName = 'test';
    const testChannelName = 'test-text-channel';
    const messageText = 'Some important text';
    let moduleRef: TestingModule;
    let guild: Guild;

    await new Promise(async (resolve, reject) => {
      try {
        @Injectable()
        class CommandBotGateway {
          constructor(
            private readonly discordProvider: DiscordClientProvider,
          ) {}

          @Once({ event: 'ready' })
          async onReady() {
            const client = this.discordProvider.getClient();
            guild = await client
              .guilds.create(testingGuildName);
            const channel = await guild.channels.create(testChannelName, {
              type: 'GUILD_TEXT',
            });
            
            await channel.send(messageText);
          }

          @On({ event: 'message' })
          async onMessage(message: Message) {
            console.log('on message: startup');
            try {
              await guild.delete();
            } catch (error) {
              console.error(`Trying to delete guild failed :`, error);
            }
            await moduleRef.close();
            try {
              expect(message.content).toStrictEqual(messageText);
              return resolve({});
            } catch (err) {
              return reject(err);
            }
          }
        }

        @Module({
          imports: [
            ConfigModule.forRoot({
              envFilePath: './test/.test.env',
            }),
            DiscordModule.forRootAsync({
              imports: [ConfigModule],
              useFactory: (configService: ConfigService) => ({
                intents: ['GUILDS', 'GUILD_MESSAGES'],
                token: configService.get('TOKEN') || process.env.TOKEN,
                commandPrefix:
                  configService.get('COMMAND_PREFIX') ||
                  process.env.COMMAND_PREFIX,
              }),
              inject: [ConfigService],
            }),
          ],
          providers: [CommandBotGateway],
        })
        class CommandBotModule {}

        moduleRef = await Test.createTestingModule({
          imports: [CommandBotModule],
        }).compile();
        await moduleRef.init();
      } catch {
        await guild.delete();
        await moduleRef.close();
        return reject();
      }
    });
  }, 30000);
});
