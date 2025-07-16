export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-gray-900 text-white pt-16">
      <div className="max-w-4xl mx-auto px-4 py-12">
        <h1 className="text-4xl font-bold mb-8 text-center">Privacy Policy</h1>
        
        <div className="bg-gray-800 rounded-lg p-8 space-y-8">
          <div>
            <h2 className="text-2xl font-semibold mb-4">1. Information We Collect</h2>
            <p className="text-gray-300 mb-4">
              We collect information you provide directly to us, such as when you create an account, place an order, or contact us for support.
            </p>
            <p className="text-gray-300 mb-4">This may include:</p>
            <ul className="text-gray-300 space-y-2 ml-6">
              <li>• Name, email address, and shipping address</li>
              <li>• Payment information (processed securely through Stripe)</li>
              <li>• Order history and preferences</li>
              <li>• Communications with our customer service team</li>
            </ul>
          </div>

          <div>
            <h2 className="text-2xl font-semibold mb-4">2. How We Use Your Information</h2>
            <p className="text-gray-300 mb-4">We use the information we collect to:</p>
            <ul className="text-gray-300 space-y-2 ml-6">
              <li>• Process and fulfill your orders</li>
              <li>• Send order confirmations and tracking information</li>
              <li>• Provide customer support</li>
              <li>• Improve our website and services</li>
              <li>• Send marketing communications (with your consent)</li>
              <li>• Comply with legal obligations</li>
            </ul>
          </div>

          <div>
            <h2 className="text-2xl font-semibold mb-4">3. Information Sharing</h2>
            <p className="text-gray-300 mb-4">
              We do not sell, trade, or otherwise transfer your personal information to third parties except as described in this policy.
            </p>
            <p className="text-gray-300 mb-4">We may share your information with:</p>
            <ul className="text-gray-300 space-y-2 ml-6">
              <li>• Payment processors (Stripe) to process payments</li>
              <li>• Shipping carriers to deliver your orders</li>
              <li>• Service providers who assist in our operations</li>
              <li>• Law enforcement when required by law</li>
            </ul>
          </div>

          <div>
            <h2 className="text-2xl font-semibold mb-4">4. Data Security</h2>
            <p className="text-gray-300 mb-4">
              We implement appropriate security measures to protect your personal information against unauthorized access, alteration, disclosure, or destruction.
            </p>
            <p className="text-gray-300">
              Your payment information is encrypted and processed securely through Stripe, and we do not store your complete payment details on our servers.
            </p>
          </div>

          <div>
            <h2 className="text-2xl font-semibold mb-4">5. Cookies and Tracking</h2>
            <p className="text-gray-300 mb-4">
              We use cookies and similar technologies to enhance your browsing experience, remember your preferences, and analyze website traffic.
            </p>
            <p className="text-gray-300">
              You can control cookie settings through your browser preferences, though disabling cookies may affect website functionality.
            </p>
          </div>

          <div>
            <h2 className="text-2xl font-semibold mb-4">6. Your Rights</h2>
            <p className="text-gray-300 mb-4">You have the right to:</p>
            <ul className="text-gray-300 space-y-2 ml-6">
              <li>• Access your personal information</li>
              <li>• Update or correct your information</li>
              <li>• Request deletion of your account</li>
              <li>• Opt out of marketing communications</li>
              <li>• Contact us with privacy concerns</li>
            </ul>
          </div>

          <div>
            <h2 className="text-2xl font-semibold mb-4">7. Children's Privacy</h2>
            <p className="text-gray-300">
              Our website is not intended for children under 13 years of age. We do not knowingly collect personal information from children under 13. If we become aware that we have inadvertently received personal information from a child under the age of 13, we will delete such information from our records immediately.
            </p>
          </div>

          <div>
            <h2 className="text-2xl font-semibold mb-4">8. Changes to This Policy</h2>
            <p className="text-gray-300">
              We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new policy on this page and updating the "Last Updated" date.
            </p>
          </div>

          <div className="bg-blue-900 rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Contact Us</h2>
            <p className="text-gray-300 mb-4">
              If you have any questions about this Privacy Policy or our data practices, please contact us:
            </p>
            <div className="space-y-2 text-gray-300">
              <p>Email: ktwholesalefinds.help@gmail.com</p>
            </div>
          </div>

          <div className="text-center text-gray-400 text-sm">
            <p>Last updated: {new Date().toLocaleDateString()}</p>
          </div>
        </div>
      </div>
    </div>
  );
} 