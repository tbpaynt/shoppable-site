export type Product = {
  id: number;
  listing_number: string;
  name: string;
  image: string;
  price: number;
  retail: number;
  countdown: Date;
  published: boolean;
  stock: number;
  description: string;
};

export const products: Product[] = [
  {
    id: 1,
    listing_number: "A001",
    name: "Impulse Gadget",
    image: "https://via.placeholder.com/200x200?text=Product+1",
    price: 19.99,
    retail: 39.99,
    countdown: new Date(Date.now() + 1000 * 60 * 60 * 2),
    published: false,
    stock: 10,
    description: "A cool impulse gadget.",
  },
  {
    id: 2,
    listing_number: "A002",
    name: "Quick Buy Widget",
    image: "https://via.placeholder.com/200x200?text=Product+2",
    price: 9.99,
    retail: 24.99,
    countdown: new Date(Date.now() + 1000 * 60 * 30),
    published: false,
    stock: 5,
    description: "A handy quick buy widget.",
  },
  {
    id: 3,
    listing_number: "A003",
    name: "Flash Sale Thing",
    image: "https://via.placeholder.com/200x200?text=Product+3",
    price: 14.99,
    retail: 29.99,
    countdown: new Date(Date.now() + 1000 * 60 * 10),
    published: false,
    stock: 0,
    description: "A must-have flash sale thing.",
  },
];