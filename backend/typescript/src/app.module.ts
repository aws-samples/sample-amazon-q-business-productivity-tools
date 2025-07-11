// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { QBusinessController } from './controllers/qbusiness.controller';
import { QBusinessService } from './services/qbusiness.service';
import { DynamoDBService } from './services/dynamodb.service';
import { CredentialExchangeService } from './services/credential-exchange.service';
import { CredentialExchangeController } from './controllers/credential-exchange.controller';
import { QBusinessChatService } from './services/qbusiness-chat.service';
import { QBusinessChatController } from './controllers/qbusiness-chat.controller';
import { CloudWatchService } from './services/cloudwatch.service';
import { CloudWatchController } from './controllers/cloudwatch.controller';
import { BedrockService } from './services/bedrock.service';
import { BedrockController } from './controllers/bedrock.controller';
import { S3Service } from './services/s3.service';
import { S3Controller } from './controllers/s3.controller';
import { QBusinessStreamingChatService } from './services/qbusiness-streaming-chat.service';
import { QBusinessStreamingChatController } from './controllers/qbusiness-streaming-chat.controller';
import { ConfigService } from './services/config.service';
import { ConfigController } from './controllers/config.controller';

@Module({
  imports: [],
  controllers: [
    AppController,
    QBusinessController,
    CredentialExchangeController,
    QBusinessChatController,
    CloudWatchController,
    BedrockController,
    S3Controller,
    QBusinessStreamingChatController,
    ConfigController,
  ],
  providers: [
    AppService,
    QBusinessService,
    DynamoDBService,
    CredentialExchangeService,
    QBusinessChatService,
    CloudWatchService,
    BedrockService,
    S3Service,
    QBusinessStreamingChatService,
    ConfigService,
  ],
})
export class AppModule {}
