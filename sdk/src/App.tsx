import React, { useEffect, useState } from 'react';
import logo from './logo.svg';
import './App.css';
import { Client } from "@langchain/langgraph-sdk"

export const App: React.FC = () => {
  const [assistants, setAssistants] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [inputValue, setInputValue] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const client = new Client({apiUrl: "https://spooky.jockey.ngrok.app"});
  const indexID = process.env.REACT_APP_API_INDEX_ID;

  function formatToolCalls(toolCalls: any[]) {
    if (toolCalls && toolCalls.length > 0) {
      console.log(toolCalls);
      const formattedCalls = toolCalls.map(call => call.name);
      return formattedCalls.join("\n");
    }
    return "No tool calls";
  }

  function extractAgentName(str: string) {
    const match = str.match(/"next_worker"\s*:\s*"([^"]+)"/);
    return match ? match[1] : '';
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
  };

  const initializeChat = async () => {
    if (!inputValue.trim() || isProcessing) return;
    
    setIsProcessing(true);
    let storedAgentName = '';

    try {
      // List available assistants
      const assistantsList = await client.assistants.search();
      setAssistants(assistantsList);

      // Get the first assistant
      const assistant = assistantsList[0];

      // Create a new thread
      const thread = await client.threads.create();

      // List runs on this thread
      const runs = await client.runs.list(thread.thread_id);

      const input = {
        chat_history: [{ type: "user", content: `${indexID} ${inputValue}` }],
      };

      // Stream handling
      for await (const event of client.runs.stream(
        thread.thread_id,
        assistant.assistant_id,
        { input, streamMode: "messages" }
      )) {
        if (event.event === "metadata") {
          console.log('Event', event);
          const data = event.data;
        } else if (event.event === "on_tool_start") {
          console.log("START X");
        } else if (event.event === "messages/partial") {
          for (const dataItem of event?.data) {
            if ("role" in dataItem && dataItem.role === "user") {
              console.log(`Human: ${dataItem.content}`);
            } else {
              console.log('item', dataItem);
              const content = dataItem.content || "";
              const responseMetadata = dataItem.response_metadata || {};

              if (responseMetadata) {
                try {
                  const functionCallArgs = dataItem.additional_kwargs?.function_call?.arguments || '';
                  const currentAgentName = extractAgentName(functionCallArgs);
                  if (currentAgentName) {
                    storedAgentName = currentAgentName;
                  }
                } catch (error) {
                  console.error("Error with function arguments:", error);
                }

                const finishReason = responseMetadata.finish_reason || "N/A";
                console.log(`Response Metadata: Finish Reason - ${finishReason}`);

                if (finishReason === 'stop') {
                  console.log(`${storedAgentName} ${content}`);
                  setMessages(prev => {
                    // Check if this message already exists
                    const messageExists = prev.some(msg => 
                      msg.text === content && msg.linkText === storedAgentName
                    );
                    
                    if (messageExists) return prev;
                    
                    return [...prev, {
                      sender: 'ai',
                      text: content,
                      link: '',
                      linkText: storedAgentName,
                      twelveText: content,
                      asrTest: '',
                      lameText: '',
                      question: inputValue
                    }];
                  });
                }
              }
            }
          }
        }
      }
    } catch (error) {
      console.error("Error in chat initialization:", error);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="App">
      <header className="App-header">
      <div className="input-container" style={{ 
          marginBottom: '20px',
          width: '100%',
          maxWidth: '800px',
          padding: '0 20px',
          alignSelf: 'flex-start',
          display: 'flex',
          justifyContent: 'flex-start'
        }}>
          <div style={{
            display: 'flex',
            gap: '10px',
            maxWidth: '800px',
            width: '100%'
          }}>
            <input
              type="text"
              value={inputValue}
              onChange={handleInputChange}
              placeholder="Enter your message..."
              style={{
                padding: '12px 16px',
                borderRadius: '4px',
                border: '1px solid #ccc',
                width: '100%',
                maxWidth: '500px',
                fontSize: '16px',
                color: '#000000',
                backgroundColor: '#ffffff'
              }}
            />
            <button
              onClick={initializeChat}
              disabled={isProcessing}
              style={{
                padding: '12px 24px',
                borderRadius: '4px',
                backgroundColor: isProcessing ? '#cccccc' : '#61dafb',
                border: 'none',
                color: 'white',
                cursor: isProcessing ? 'not-allowed' : 'pointer',
                fontSize: '16px',
                whiteSpace: 'nowrap',
                minWidth: 'fit-content'
              }}
            >
              {isProcessing ? 'Processing...' : 'Launch Jockey'}
            </button>
          </div>
        </div>
        
      {messages.map((message, index) => (
        <div key={index} style={{
          margin: '10px',
          padding: '20px',
          backgroundColor: 'rgba(97, 218, 251, 0.1)',
          borderRadius: '8px',
          width: '100%',
          maxWidth: '800px',
          alignSelf: 'flex-start',
          wordBreak: 'break-word',
          boxSizing: 'border-box'
        }}>
          <div style={{ 
            fontWeight: 'bold', 
            marginBottom: '10px',
            textAlign: 'left',
            fontSize: '0.9em',
            color: '#61dafb'
          }}>
            {message.linkText && message.text && message.linkText}
          </div>
          <div style={{
            textAlign: 'left',
            lineHeight: '1.5',
            fontSize: '0.9em',
            whiteSpace: 'pre-wrap'
          }}>
            {message.text}
          </div>
        </div>
      ))}
      </header>
    </div>
  );
};

export default App;