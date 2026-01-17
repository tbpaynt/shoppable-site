export default function ShippingPage() {
  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold text-center mb-12">Shipping Information</h1>
        
        <div className="space-y-8">
          {/* Processing Time */}
          <div className="bg-gray-800 p-6 rounded-lg">
            <h2 className="text-2xl font-semibold mb-4">Processing Time</h2>
            <p className="text-gray-300">
              Orders are typically processed and shipped within 3 business days after payment confirmation. During peak seasons or sales, processing may and can take longer.
            </p>
          </div>


          {/* Tracking Information */}
          <div className="bg-gray-800 p-6 rounded-lg">
            <h2 className="text-2xl font-semibold mb-4">Tracking Information</h2>
            <p className="text-gray-300 mb-2">
              Once your order ships, you&apos;ll receive a confirmation email with tracking information. You can also track your order through your account dashboard.
            </p>
            <p className="text-gray-300">
              Tracking numbers are typically available within 24 hours of shipment.
            </p>
          </div>

          {/* Delivery Areas */}
          <div className="bg-gray-800 p-6 rounded-lg">
            <h2 className="text-2xl font-semibold mb-4">Delivery Areas</h2>
            <p className="text-gray-300 mb-2">
              We currently ship to all 50 US states and territories. International shipping is not available at this time.
            </p>
            <p className="text-gray-300">
              Some remote areas may have additional delivery times or restrictions.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
} 