'use client'

import Image from 'next/image'
import Link from 'next/link'

export default function Header() {
  return (
    <header className="bg-green-100 shadow py-4 flex items-center justify-between px-4">
      {/* Venstre: Logo */}
      <div className="flex items-center">
        <Image 
          src="/assets/tank-svgrepo-com.svg" 
          alt="Tank logo" 
          width={100} 
          height={40} 
          priority 
        />
      </div>

      {/* Midten: Navigasjon */}
      <nav className="flex-1 flex justify-center gap-8 text-lg font-medium">
        <Link href="/" className="hover:underline">Hjem</Link>
        <Link href="/om-oss" className="hover:underline">Om oss</Link>
      </nav>

      {/* Høyre: tom for nå, men tar plass slik at midten faktisk er midtstilt */}
      <div style={{ width: '100px' }} />
    </header>
  )
}
