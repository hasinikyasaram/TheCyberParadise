import './globals.css';
import React from 'react';

export const metadata = {
  title: 'ShipTrack Sentinel — Security-First Logistics Platform',
  description: 'Proving identity, authorization, state machine integrity, and zero-trust data protection at every layer.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[#090d16] text-slate-100 antialiased">
        {children}
      </body>
    </html>
  );
}
