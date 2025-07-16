export default function TermsPage() {
  return (
    <div className="min-h-screen bg-gray-900 text-white pt-16">
      <div className="max-w-4xl mx-auto px-4 py-12">
        <h1 className="text-4xl font-bold mb-8 text-center">Terms of Service</h1>
        
        <div className="bg-gray-800 rounded-lg p-8 space-y-8">
          <div>
            <h2 className="text-2xl font-semibold mb-4">1. Acceptance of Terms</h2>
            <p className="text-gray-300 mb-4">
              By accessing and using KT Wholesale Finds (&quot;we,&quot; &quot;us,&quot; or &quot;our&quot;), you accept and agree to be bound by the terms and provision of this agreement.
            </p>
            <p className="text-gray-300">
              If you do not agree to abide by the above, please do not use this service.
            </p>
          </div>

          <div>
            <h2 className="text-2xl font-semibold mb-4">2. Use License</h2>
            <p className="text-gray-300 mb-4">
              Permission is granted to temporarily download one copy of the materials (information or software) on KT Wholesale Finds&apos;s website for personal, non-commercial transitory viewing only.
            </p>
            <p className="text-gray-300 mb-4">This is the grant of a license, not a transfer of title, and under this license you may not:</p>
            <ul className="text-gray-300 space-y-2 ml-6">
              <li>• Modify or copy the materials</li>
              <li>• Use the materials for any commercial purpose or for any public display</li>
              <li>• Attempt to reverse engineer any software contained on the website</li>
              <li>• Remove any copyright or other proprietary notations from the materials</li>
            </ul>
          </div>

          <div>
            <h2 className="text-2xl font-semibold mb-4">3. Product Information</h2>
            <p className="text-gray-300 mb-4">
              We strive to provide accurate product information, including descriptions, prices, and availability. However, we do not warrant that product descriptions or other content is accurate, complete, reliable, current, or error-free.
            </p>
          </div>

          <div>
            <h2 className="text-2xl font-semibold mb-4">4. Pricing and Payment</h2>
            <p className="text-gray-300 mb-4">
              All prices are subject to change without notice. We reserve the right to modify or discontinue any product at any time.
            </p>
            <p className="text-gray-300 mb-4">
              Payment must be made at the time of order placement. We accept various payment methods as indicated on our checkout page.
            </p>
            <p className="text-gray-300">
              Sales tax will be added to orders as required by law.
            </p>
          </div>

          <div>
            <h2 className="text-2xl font-semibold mb-4">5. Shipping and Delivery</h2>
            <p className="text-gray-300 mb-4">
              We will ship your order as soon as possible after payment confirmation. Delivery times are estimates and may vary based on location and shipping method selected.
            </p>
            <p className="text-gray-300">
              Risk of loss and title for items purchased pass to you upon delivery of the items to the carrier.
            </p>
          </div>

          <div>
            <h2 className="text-2xl font-semibold mb-4">6. Returns and Refunds</h2>
            <p className="text-gray-300 mb-4">
              All sales are final. Please refer to our Return Policy for detailed information about our &quot;All Sales Final&quot; policy.
            </p>
            <p className="text-gray-300">
              No returns, refunds, or exchanges are accepted unless otherwise specified in our Return Policy.
            </p>
          </div>

          <div>
            <h2 className="text-2xl font-semibold mb-4">7. User Accounts</h2>
            <p className="text-gray-300 mb-4">
              When you create an account with us, you must provide accurate and complete information. You are responsible for safeguarding your account credentials.
            </p>
            <p className="text-gray-300">
              You agree to accept responsibility for all activities that occur under your account.
            </p>
          </div>

          <div>
            <h2 className="text-2xl font-semibold mb-4">8. Privacy Policy</h2>
            <p className="text-gray-300">
              Your privacy is important to us. Please review our Privacy Policy, which also governs your use of the website, to understand our practices.
            </p>
          </div>

          <div>
            <h2 className="text-2xl font-semibold mb-4">9. Limitation of Liability</h2>
            <p className="text-gray-300 mb-4">
              In no event shall KT Wholesale Finds or its suppliers be liable for any damages (including, without limitation, damages for loss of data or profit, or due to business interruption) arising out of the use or inability to use the materials on our website.
            </p>
            <p className="text-gray-300">
              Our total liability to you for any claims arising from your use of our website or services shall not exceed the amount you paid for the specific product or service giving rise to the claim.
            </p>
          </div>

          <div>
            <h2 className="text-2xl font-semibold mb-4">10. Governing Law</h2>
            <p className="text-gray-300">
              These terms and conditions are governed by and construed in accordance with the laws of the United States and you irrevocably submit to the exclusive jurisdiction of the courts in that location.
            </p>
          </div>

          <div>
            <h2 className="text-2xl font-semibold mb-4">11. Changes to Terms</h2>
            <p className="text-gray-300">
              We reserve the right to modify these terms at any time. Changes will be effective immediately upon posting on the website. Your continued use of the website constitutes acceptance of the modified terms.
            </p>
          </div>

          <div className="bg-blue-900 rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Contact Information</h2>
            <p className="text-gray-300 mb-4">
              If you have any questions about these Terms of Service, please contact us:
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