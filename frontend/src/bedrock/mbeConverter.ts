// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { SourceAttribution, TextSegment } from '@aws-sdk/client-qbusiness';

export interface BatchChatResponse {
  responses?: MbeResponse[];
}

export interface MbeResponse {
  conversationTurns?: string[];
}

export interface ChatSyncResponse {
  prompt: string;
  groundTruth: string;
  response: string;
  conversation_id: string;
  user_message_id: string;
  system_message_id: string;
  sourceAttributions: SourceAttribution[];
}

export interface RetrievalResult {
  content: {
    text: string;
  };
  metadata: {
    title: string;
    url: string;
  };
}

export interface Citation {
  generatedResponsePart: {
    textResponsePart: {
      span: {
        start: number;
        end: number;
      };
      text: string;
    };
  };
  retrievedReferences: [
    {
      content: {
        text: string;
      };
      metadata: {
        title: string;
        url: string;
      };
    },
  ];
}

function getCitation(segment: TextSegment, attribution: SourceAttribution): Citation {
  return {
    generatedResponsePart: {
      textResponsePart: {
        span: {
          start: segment.beginOffset || 0,
          end: segment.endOffset || 0,
        },
        text: segment.snippetExcerpt!.text || '',
      },
    },
    retrievedReferences: [
      {
        content: {
          text: attribution.snippet || '',
        },
        metadata: {
          title: attribution.title || '',
          url: attribution.url || '',
        },
      },
    ],
  };
}

export function convertJsonFormat(chatSyncResponse: ChatSyncResponse): Mbe {
  const citations: Citation[] = [];
  const retrievalResults: RetrievalResult[] = [];
  if (chatSyncResponse.sourceAttributions) {
    chatSyncResponse.sourceAttributions.forEach((attribution) => {
      attribution.textMessageSegments!.forEach((segment) => {
        const citation = getCitation(segment, attribution);
        citations.push(citation);
      });

      const retrievalResult = {
        content: {
          text: attribution.snippet || '',
        },
        metadata: {
          title: attribution.title || '',
          url: attribution.url || '',
        },
      };
      retrievalResults.push(retrievalResult);
    });
  }

  const destinationJson: Mbe = {
    conversationTurns: [
      {
        prompt: {
          content: [
            {
              text: chatSyncResponse.prompt,
            },
          ],
        },
        referenceResponses: [
          {
            content: [
              {
                text: chatSyncResponse.groundTruth,
              },
            ],
          },
        ],
        output: {
          text: chatSyncResponse.response,
          knowledgeBaseIdentifier: 'user_knowledge_base',
          retrievedPassages: {
            retrievalResults: retrievalResults,
          },
          citations: citations,
        },
      },
    ],
  };
  return destinationJson;
}

export interface ConversationTurn {
  prompt: {
    content: [
      {
        text: string;
      },
    ];
  };
  referenceResponses: [
    {
      content: [
        {
          text: string;
        },
      ];
    },
  ];
  output: {
    text: string;
    knowledgeBaseIdentifier: 'user_knowledge_base';
    citations: Citation[];
    retrievedPassages: {
      retrievalResults: RetrievalResult[];
    };
  };
}

export interface Mbe {
  conversationTurns: ConversationTurn[];
}
