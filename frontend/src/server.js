const express = require('express');
const cors = require('cors');
const { QBusinessClient, ChatCommand } = require('@aws-sdk/client-qbusiness');

const app = express();
const port = 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Chat endpoint
app.post('/api/chat', async (req, res) => {
  try {
    const {
      applicationId,
      message,
      conversationId,
      systemMessageId,
      attributeFilter,
      selectedPlugin,
      actionExecution,
      credentials,
      region
    } = req.body;

    // Initialize AWS client with credentials
    const qBusinessClient = new QBusinessClient({
      credentials,
      region
    });

    // Create a proper ChatCommandInput
    const input = {
      applicationId,
      // Create an async generator function to provide the input stream
      inputStream: (async function* () {
        // First, yield any configuration if needed
        if (attributeFilter) {
          yield {
            configurationEvent: {
              chatMode: 'RETRIEVAL_MODE',
              attributeFilter
            }
          };
        } else if (selectedPlugin) {
          yield {
            configurationEvent: {
              chatMode: 'PLUGIN_MODE',
              chatModeConfiguration: {
                pluginConfiguration: {
                  pluginId: selectedPlugin
                }
              }
            }
          };
        }
        
        // Then yield the text event with the user message
        yield {
          textEvent: {
            userMessage: message
          }
        };
        
        // End the input stream
        yield { endOfInputEvent: {} };
      })()
    };

    // Add conversationId if provided
    if (conversationId) {
      input.conversationId = conversationId;
    }

    if (systemMessageId) {
      input.parentMessageId = systemMessageId;
    }

    // Set up response headers for streaming
    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('Transfer-Encoding', 'chunked');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // Send the command
    const command = new ChatCommand(input);
    const response = await qBusinessClient.send(command);

    // Variables to track the state across chunks
    let responseConversationId = '';
    let responseSystemMessageId = '';
    let sourceAttributions = [];
    
    // Process the outputStream and send chunks to the client
    if (response.outputStream) {
      for await (const chunk of response.outputStream) {
        if ('textEvent' in chunk && chunk.textEvent) {
          // Extract text from the text event
          const textContent = chunk.textEvent.systemMessage || '';
          
          // Only set these once if they're not already set
          if (!responseConversationId && chunk.textEvent.conversationId) {
            responseConversationId = chunk.textEvent.conversationId;
          }
          if (!responseSystemMessageId && chunk.textEvent.systemMessageId) {
            responseSystemMessageId = chunk.textEvent.systemMessageId;
          }
          
          // Send the text chunk to the client
          if (textContent) {
            const data = {
              type: 'text',
              content: textContent,
              conversationId: responseConversationId,
              systemMessageId: responseSystemMessageId
            };
            res.write(JSON.stringify(data) + '\n');
          }
        }
        
        if ('metadataEvent' in chunk && chunk.metadataEvent) {
          // Get source attributions from metadata event
          sourceAttributions = chunk.metadataEvent.sourceAttributions || [];
          
          // Send the metadata to the client
          const data = {
            type: 'metadata',
            sourceAttributions: sourceAttributions,
            conversationId: chunk.metadataEvent.conversationId || responseConversationId,
            systemMessageId: chunk.metadataEvent.systemMessageId || responseSystemMessageId
          };
          res.write(JSON.stringify(data) + '\n');
        }
      }
    }
    
    // Signal that the stream is complete
    const data = {
      type: 'complete',
      isComplete: true,
      conversationId: responseConversationId,
      systemMessageId: responseSystemMessageId,
      sourceAttributions: sourceAttributions
    };
    res.write(JSON.stringify(data) + '\n');
    
    // End the response
    res.end();
  } catch (error) {
    console.error('Error in chat:', error);
    
    // Send error response
    const errorData = {
      type: 'error',
      message: error.message || 'An error occurred while processing your request'
    };
    
    res.status(500).json(errorData);
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Proxy server running at http://localhost:${port}`);
});
