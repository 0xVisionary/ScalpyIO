export const PrivacyPolicy = () => {
  return (
    <div className="min-h-screen py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold text-[#8131CF] mb-8">
          Privacy Policy
        </h1>
        <div className="text-gray-500 italic mb-8">
          Last Updated: February 24, 2025
        </div>

        <div className="prose prose-lg">
          <p className="text-gray-600">
            Welcome to the Privacy Policy for Scalpy AI Trading Scanner ("we,"
            "our," or "us"). This Privacy Policy explains how we collect, use,
            and protect your information when you use our Chrome extension.
          </p>

          <h2 className="text-2xl font-semibold text-[#8131CF] mt-8 mb-4">
            Information We Collect
          </h2>
          <p className="text-gray-600">
            Our extension collects and processes the following types of
            information:
          </p>
          <ul className="list-disc pl-6 text-gray-600 space-y-2">
            <li>
              <strong>Token Addresses:</strong> We collect cryptocurrency token
              addresses from web pages you visit that match our supported
              domains.
            </li>
            <li>
              <strong>Extension Usage Data:</strong> We collect basic usage
              information such as when you open the extension and interact with
              its features.
            </li>
            <li>
              <strong>Chat Messages:</strong> When you interact with our AI
              assistant, we process the messages you send to provide analysis
              and responses.
            </li>
            <li>
              <strong>Technical Information:</strong> We collect your extension
              ID to maintain your session and provide our services.
            </li>
          </ul>

          <h2 className="text-2xl font-semibold text-[#8131CF] mt-8 mb-4">
            How We Use Your Information
          </h2>
          <ul className="list-disc pl-6 text-gray-600 space-y-2">
            <li>To provide token analysis and insights</li>
            <li>To maintain and improve our services</li>
            <li>To detect and prevent technical issues</li>
            <li>To communicate with you through our AI assistant</li>
          </ul>

          <h2 className="text-2xl font-semibold text-[#8131CF] mt-8 mb-4">
            Data Storage and Security
          </h2>
          <ul className="list-disc pl-6 text-gray-600 space-y-2">
            <li>
              All communication between the extension and our servers is
              encrypted using HTTPS
            </li>
            <li>We use secure WebSocket connections for real-time updates</li>
            <li>We implement rate limiting to prevent abuse</li>
            <li>
              We do not store your chat history or analyzed token addresses
              permanently
            </li>
          </ul>

          <h2 className="text-2xl font-semibold text-[#8131CF] mt-8 mb-4">
            Third-Party Services
          </h2>
          <p className="text-gray-600">
            Our extension integrates with the following third-party services:
          </p>
          <ul className="list-disc pl-6 text-gray-600 space-y-2">
            <li>
              <strong>Birdeye API:</strong> Used to fetch token metrics and
              market data. Their use of data is governed by their own privacy
              policy.
            </li>
          </ul>

          <h2 className="text-2xl font-semibold text-[#8131CF] mt-8 mb-4">
            Data Retention
          </h2>
          <ul className="list-disc pl-6 text-gray-600 space-y-2">
            <li>
              Chat sessions are temporary and cleared when you close the
              extension
            </li>
            <li>Token analysis data is not stored permanently</li>
            <li>Extension settings are stored locally in your browser</li>
          </ul>

          <h2 className="text-2xl font-semibold text-[#8131CF] mt-8 mb-4">
            Your Rights
          </h2>
          <ul className="list-disc pl-6 text-gray-600 space-y-2">
            <li>Access your personal data</li>
            <li>Delete your data by uninstalling the extension</li>
            <li>
              Opt-out of data collection by disabling or removing the extension
            </li>
          </ul>

          <h2 className="text-2xl font-semibold text-[#8131CF] mt-8 mb-4">
            Changes to This Policy
          </h2>
          <p className="text-gray-600">
            We may update this Privacy Policy from time to time. We will notify
            you of any changes by posting the new Privacy Policy on this page
            and updating the "Last Updated" date.
          </p>

          <h2 className="text-2xl font-semibold text-[#8131CF] mt-8 mb-4">
            Contact Us
          </h2>
          <p className="text-gray-600">
            If you have any questions about this Privacy Policy, please contact
            us at:
          </p>
          <ul className="list-disc pl-6 text-gray-600 space-y-2">
            <li>
              Website:{" "}
              <a
                href="https://scalpy-ej34na2x1-exe1xs-projects.vercel.app/"
                className="text-[#8131CF] hover:underline"
              >
                Scalpy.io
              </a>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
};
