import { useState, useEffect } from "react";
import { Bot, MessageCircle } from "lucide-react";

export const ChatAnimation = () => {
  const [step, setStep] = useState(0);

  const messages = [
    { type: "bot", text: "How can I help you?" },
    {
      type: "user",
      text: "Can you scan this: 6p6xgHyF7AeE6TZkSmFsko444wqoP15icUSqi2jfGiPN",
    },
    {
      type: "bot",
      text: "Strong buy signals: High liquidity, active whale accumulation, and growing community 📈",
    },
    { type: "user", text: "Does it look like a rug pull?" },
    {
      type: "bot",
      text: "No, it looks like a legitimate project. It has a good community and a strong team.",
    },
  ];

  useEffect(() => {
    const timer = setInterval(() => {
      setStep((prev) => (prev === messages.length * 2 - 1 ? 0 : prev + 1));
    }, 2000);
    return () => clearInterval(timer);
  }, []);

  const TypingIndicator = () => (
    <div className="flex space-x-1">
      <div
        className="w-1.5 h-1.5 rounded-full bg-current animate-[bounce_0.8s_infinite]"
        style={{ animationDelay: "0ms" }}
      />
      <div
        className="w-1.5 h-1.5 rounded-full bg-current animate-[bounce_0.8s_infinite]"
        style={{ animationDelay: "200ms" }}
      />
      <div
        className="w-1.5 h-1.5 rounded-full bg-current animate-[bounce_0.8s_infinite]"
        style={{ animationDelay: "400ms" }}
      />
    </div>
  );

  return (
    <div className="w-[400px] h-[600px] bg-white rounded-xl shadow-2xl overflow-hidden flex flex-col">
      {/* Extension Header */}
      <div className="bg-[#8131CF] p-4 flex items-center gap-2">
        <img
          src="/scalpy.png"
          alt="Scalpy"
          className="h-6 w-auto"
          width={48}
          height={48}
          loading="eager"
        />
        <span className="text-white font-medium">Scalpy</span>
      </div>

      {/* Chat Container */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message, index) => {
          const messageStep = index * 2 + 1;
          const isVisible = step >= messageStep;
          const isCurrentlyTyping = step === index * 2;
          const showMessage = step > index * 2;

          return (
            <div
              key={index}
              className={`
                transition-all duration-500 ease-in-out
                ${
                  message.type === "bot"
                    ? "flex items-start"
                    : "flex flex-row-reverse items-start"
                }
                ${
                  isVisible || isCurrentlyTyping
                    ? "opacity-100 translate-y-0"
                    : "opacity-0 translate-y-4"
                }
              `}
            >
              <div
                className={`flex items-start ${
                  message.type === "user" ? "flex-row-reverse" : ""
                } max-w-[85%]`}
              >
                <div
                  className={`flex-shrink-0 w-6 h-6 rounded-full shadow-[0_2px_8px_rgba(0,0,0,0.2)] flex items-center justify-center
                    ${message.type === "bot" ? "bg-[#8131CF]" : "bg-gray-100"}
                  `}
                >
                  {message.type === "bot" ? (
                    <Bot className="w-4 h-4 text-white" />
                  ) : (
                    <MessageCircle className="w-4 h-4 text-gray-600" />
                  )}
                </div>
                <div
                  className={`mx-2 ${
                    message.type === "user" ? "text-right" : ""
                  }`}
                >
                  <div
                    className={`inline-block p-2 rounded-lg text-sm
                      ${
                        message.type === "bot"
                          ? "bg-[#8131CF] text-white rounded-tl-none shadow-[0_2px_8px_rgba(0,0,0,0.2)]"
                          : "bg-gray-100 text-gray-800 rounded-tr-none shadow-[0_2px_8px_rgba(0,0,0,0.2)]"
                      }
                    `}
                  >
                    {isCurrentlyTyping && (
                      <div
                        className={
                          message.type === "bot"
                            ? "text-white"
                            : "text-gray-400"
                        }
                      >
                        <TypingIndicator />
                      </div>
                    )}
                    {showMessage && (
                      <p className="text-sm break-all">{message.text}</p>
                    )}
                  </div>
                  <div
                    className={`mt-1 text-[10px] text-gray-500 ${
                      message.type === "user" ? "text-right" : ""
                    }`}
                  >
                    {message.type === "bot" ? "Scalpy" : "You"} • Just now
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Input Area */}
      <div className="border-t p-4 bg-gray-50">
        <div className="bg-white border rounded-lg p-2 text-sm text-gray-400">
          Type a message...
        </div>
      </div>
    </div>
  );
};
