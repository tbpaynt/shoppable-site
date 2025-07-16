export default function AboutPage() {
  return (
    <div className="min-h-screen bg-gray-900 text-white pt-16">
      <div className="max-w-4xl mx-auto px-4 py-12">
        <h1 className="text-4xl font-bold mb-8 text-center">About KT Wholesale Finds</h1>
        
        <div className="bg-gray-800 rounded-lg p-8 mb-8">
          <h2 className="text-2xl font-semibold mb-4">Our Story</h2>
          <p className="text-gray-300 mb-4">
            KT Wholesale Finds is a <strong className="text-white">family-owned and operated</strong> business 
            founded with a simple mission: to bring amazing deals and wholesale prices directly to our customers. 
            We believe everyone deserves access to quality products at unbeatable prices.
          </p>
          <p className="text-gray-300 mb-4">
            What started as a small operation has grown into a trusted source for customers looking for 
            the best deals on a wide variety of products. We work directly with manufacturers and suppliers 
            to cut out the middleman and pass the savings directly to you.
          </p>
          <div className="bg-blue-900 p-6 rounded-lg mt-6">
            <h3 className="text-xl font-bold text-blue-200 mb-2 text-center">Our Promise</h3>
            <p className="text-blue-100 text-center text-lg font-semibold">
              &quot;We hunt for the deals, so that our customers can get the steals!&quot;
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
          <div className="bg-gray-800 rounded-lg p-6">
            <h3 className="text-xl font-semibold mb-4">Our Mission</h3>
            <p className="text-gray-300">
              To provide our customers with the highest quality products at wholesale prices, 
              making great deals accessible to everyone.
            </p>
          </div>
          
          <div className="bg-gray-800 rounded-lg p-6">
            <h3 className="text-xl font-semibold mb-4">Our Values</h3>
            <ul className="text-gray-300 space-y-2">
              <li>• Quality products at unbeatable prices</li>
              <li>• Exceptional customer service</li>
              <li>• Honest and transparent business practices</li>
              <li>• Fast and reliable shipping</li>
            </ul>
          </div>
        </div>

        <div className="bg-gray-800 rounded-lg p-8">
          <h2 className="text-2xl font-semibold mb-4">Why Choose KT Wholesale Finds?</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="bg-blue-600 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                </svg>
              </div>
              <h3 className="font-semibold mb-2">Best Prices</h3>
              <p className="text-gray-300 text-sm">Wholesale prices passed directly to you</p>
            </div>
            
            <div className="text-center">
              <div className="bg-green-600 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="font-semibold mb-2">Quality Guaranteed</h3>
              <p className="text-gray-300 text-sm">All products meet our quality standards</p>
            </div>
            
            <div className="text-center">
              <div className="bg-purple-600 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h3 className="font-semibold mb-2">Fast Shipping</h3>
              <p className="text-gray-300 text-sm">Quick delivery to your doorstep</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 