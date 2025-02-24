import { Button } from "./components/button";
import { ChatAnimation } from "./components/ChatAnimation";
import { FaChrome } from "react-icons/fa";

export default function App() {
  return (
    <div className="min-h-screen w-screen overflow-hidden bg-[radial-gradient(#e9dfda_33%,#f3f2f1_67%)] flex flex-col">
      {/* Navbar */}
      <nav className="relative z-50 w-full md:px-8 px-4 pt-4 md:pt-8">
        <div className="mx-auto w-full max-w-[1200px]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <img
                src="/scalpy.png"
                alt="Scalpy"
                className="h-10 md:h-14 w-auto"
                width={48}
                height={48}
                loading="eager"
              />
              <span className="hidden md:inline-block text-lg md:text-xl font-bold text-[#8131CF]">
                Scalpy
              </span>
            </div>

            <Button
              className="rounded-full shadow-lg text-sm md:text-base flex items-center gap-2"
              onClick={() => {}}
            >
              <FaChrome className="w-4 h-4 md:w-5 md:h-5" />
              Chrome Extension
            </Button>
          </div>
        </div>
      </nav>

      <main className="flex-1 flex flex-col items-center justify-center w-full max-w-[1200px] mx-auto px-4 md:px-8 pb-8 md:pb-0">
        {/* Hero Section */}
        <div className="text-center mb-8 md:mb-12 mt-16 md:mt-0">
          <h1 className="mb-3 md:mb-4 text-3xl md:text-5xl font-bold text-[#8131CF]">
            Maximize Gains.
            <br />
            Minimize Guesswork.
          </h1>
          <p className="text-base md:text-lg text-gray-600">
            Scan top holders, twitter engagement, trust score, and more
          </p>
        </div>

        {/* Chat Animation */}
        <div className="w-full flex justify-center">
          <ChatAnimation />
        </div>
      </main>
    </div>
  );
}
