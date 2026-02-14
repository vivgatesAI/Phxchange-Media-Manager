import "./globals.css";

export const metadata = {
  title: "Phxchange Media Manager",
  description: "Generate LinkedIn healthcare posts and carousel images from articles using Venice AI.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
      </body>
    </html>
  );
}
