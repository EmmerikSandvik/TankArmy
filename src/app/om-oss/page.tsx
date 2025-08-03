'use client'

import Image from 'next/image'
import Link from 'next/link'

export default function About() {
  return (
    <div
      className="min-h-screen bg-cover bg-center flex flex-col"
      style={{ backgroundImage: "url('/assets/Rambo-First-Blood.webp')" }}
    >
      {/* Toppmeny */}
      <header
        className="w-full p-4 flex items-center justify-between"
        style={{
          background: 'rgba(255, 255, 255, 0.6)',
          backdropFilter: 'blur(6px)',
          WebkitBackdropFilter: 'blur(6px)',
        }}
      >
        <Link href="/" className="flex items-center space-x-2">
          <Image
            src="/assets/tank-svgrepo-com.svg"
            alt="Tank logo"
            width={60}
            height={30}
          />
          <span className="text-lg font-semibold text-black hover:text-red-700">
            Hjem
          </span>
        </Link>
      </header>

      {/* Midtstilt innholdsboks */}
      <main className="flex-grow flex items-center justify-center p-4">
        <div
          className="max-w-lg w-full p-6 rounded-xl shadow space-y-4"
          style={{
            background: 'rgba(255, 255, 255, 0.9)',
            backdropFilter: 'blur(6px)',
            WebkitBackdropFilter: 'blur(6px)',
          }}
        >
          <h2 className="text-2xl font-semibold text-center">Om oss</h2>

          <p className="text-gray-700 text-center">
            Velkommen til TankArmy! Vi er et team dedikert til å bygge smarte
            løsninger for trening, utvikling og personlig vekst.
          </p>

          <p className="text-gray-700">
            Målet vårt er å gjøre det enklere for deg å strukturere treningen,
            lære nye ferdigheter og holde oversikt over egen fremgang.
          </p>

          <p className="text-gray-700">
            Vi kombinerer teknologi, erfaring og lidenskap for å skape en plattform
            som hjelper deg å nå målene dine – enten det handler om styrke, utholdenhet
            eller personlig utvikling.
          </p>

          {/* Bilde før navnene */}
          <div className="flex justify-center">
            <Image
              src="/assets/last%20ned.jpeg"
              alt="Team bilde"
              width={300}
              height={200}
              className="rounded-lg shadow"
            />
          </div>

          <div className="text-center">
            <p className="text-lg font-semibold mt-4">Mohamad og Emmerik</p>
            <p className="text-gray-700">Tlf: 47712251</p>
            <p className="text-gray-700">
              E-post:{' '}
              <a
                href="mailto:emmerikas@icloud.com"
                className="text-red-700 hover:underline"
              >
                emmerikas@icloud.com
              </a>
            </p>
          </div>

          {/* Footer med linker */}
          <div className="pt-4 text-center text-sm text-gray-600">
            <Link href="/contact" className="text-red-700 hover:underline mx-2">
              Kontakt
            </Link>
          </div>

          <div className="pt-2 text-center">
            <p className="text-sm text-gray-500">
              © 2025 TankArmy. Alle rettigheter forbeholdt.
            </p>
          </div>
        </div>
      </main>
    </div>
  )
}
