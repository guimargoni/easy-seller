import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
const geistSans=Geist({variable:'--font-geist-sans',subsets:['latin']});
const geistMono=Geist_Mono({variable:'--font-geist-mono',subsets:['latin']});
export const metadata:Metadata={metadataBase:new URL(process.env.NEXT_PUBLIC_SITE_URL??'http://localhost:3000'),title:'Easy Seller — Inteligência para Amazon',description:'Decisões de compra com margem, ROI, giro e risco controlado.',openGraph:{title:'Easy Seller',description:'Decisões de compra com margem, ROI e giro.',images:[{url:'/og.png',width:1200,height:630}]},twitter:{card:'summary_large_image',title:'Easy Seller',description:'Decisões de compra com margem, ROI e giro.',images:['/og.png']}};
export default function RootLayout({children}:Readonly<{children:React.ReactNode}>){return <html lang="pt-BR"><body className={`${geistSans.variable} ${geistMono.variable}`}>{children}</body></html>}
