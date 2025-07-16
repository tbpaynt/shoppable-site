export default function ReturnsPage() {
  return (
    <div className="min-h-screen bg-gray-900 text-white pt-16">
      <div className="max-w-4xl mx-auto px-4 py-12">
        <h1 className="text-4xl font-bold mb-8 text-center">Return Policy</h1>
        
        {/* Main Policy Statement */}
        <div className="bg-red-900/30 border border-red-700 rounded-lg p-8 mb-8">
          <div className="text-center mb-6">
            <h2 className="text-3xl font-bold text-red-300 mb-2">All Sales Final</h2>
            <div className="w-24 h-1 bg-red-500 mx-auto"></div>
          </div>
          <p className="text-xl text-center text-gray-200 mb-6">
            At KT Wholesale Finds, all products are sold <strong>As-Is</strong> with no returns, no refunds, and no exchanges.
          </p>
          <div className="text-center">
            <span className="bg-red-600 text-white px-6 py-2 rounded-full font-bold text-lg">
              ALL SALES ARE FINAL
            </span>
          </div>
        </div>

        {/* Important Information */}
        <div className="bg-gray-800 rounded-lg p-8 mb-8">
          <h3 className="text-2xl font-semibold mb-6 text-yellow-300">Important Information</h3>
          <div className="space-y-4">
            <div className="flex items-start space-x-4">
              <div className="bg-yellow-600 text-white rounded-full w-6 h-6 flex items-center justify-center font-bold text-sm mt-0.5">•</div>
              <p className="text-gray-300">
                Products may have package imperfections and/or cosmetic damage to boxes or outer packaging.
              </p>
            </div>
            <div className="flex items-start space-x-4">
              <div className="bg-yellow-600 text-white rounded-full w-6 h-6 flex items-center justify-center font-bold text-sm mt-0.5">•</div>
              <p className="text-gray-300">
                Unless otherwise noted, all products are new and unused.
              </p>
            </div>
            <div className="flex items-start space-x-4">
              <div className="bg-yellow-600 text-white rounded-full w-6 h-6 flex items-center justify-center font-bold text-sm mt-0.5">•</div>
              <p className="text-gray-300">
                We do our best to describe items accurately, but by purchasing from our store, you acknowledge and accept the condition of each product as described or shown in images.
              </p>
            </div>
          </div>
        </div>

        {/* Agreement Section */}
        <div className="bg-gray-800 rounded-lg p-8 mb-8">
          <h3 className="text-2xl font-semibold mb-4 text-blue-300">Purchase Agreement</h3>
          <div className="bg-blue-900/30 border border-blue-700 rounded-lg p-6">
            <p className="text-gray-200 text-lg text-center">
              By completing a purchase, you agree to these terms and acknowledge that all sales are final.
            </p>
          </div>
        </div>

        {/* Contact Section */}
        <div className="bg-gray-800 rounded-lg p-8">
          <h3 className="text-2xl font-semibold mb-6 text-green-300">Questions?</h3>
          <p className="text-gray-300 mb-6 text-center">
            If you have any questions about our policy, please don't hesitate to contact us before making your purchase.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a 
              href="/contact" 
              className="bg-green-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-green-700 transition-colors text-center"
            >
              Contact Us
            </a>
            <a 
              href="mailto:info@ktwholesalefinds.com" 
              className="bg-gray-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-gray-700 transition-colors text-center"
            >
              Email Us
            </a>
          </div>
        </div>

        {/* Thank You Message */}
        <div className="text-center mt-8">
          <p className="text-gray-400 text-lg">
            Thank you for shopping smart with us!
          </p>
        </div>
      </div>
    </div>
  );
} 