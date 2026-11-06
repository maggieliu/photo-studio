import { LayoutGrid, Plus } from 'lucide-react'
import heroUrl from '@/assets/hero.webp'
import { Button } from '@/components/ui/button'

type Props = {
  disabled: boolean
  onUpload: () => void
  onOpenLibrary: () => void
}

/**
 * First-run welcome: the hero image with two ways in. Covers the whole screen.
 *
 * The picture is square. On a wide screen it fills the screen behind the buttons. On a
 * portrait screen (a phone) that would zoom in and crop most of it away, so there it is shown
 * whole at full width, fading into the background at the top and bottom, with the buttons below.
 */
export function Landing({ disabled, onUpload, onOpenLibrary }: Props) {
  return (
    <main className="fixed inset-0 z-40 flex flex-col items-center justify-end overflow-hidden bg-background portrait:justify-center portrait:gap-4 portrait:pt-[env(safe-area-inset-top)]">
      {/* On wide screens this wrapper adds no box of its own, so the picture fills the screen. */}
      <div className="contents portrait:relative portrait:block portrait:w-full">
        <img
          src={heroUrl}
          alt="A photo editor open on a fjord landscape, with an album strip, adjustment sliders and a crop frame"
          fetchPriority="high"
          className={[
            'absolute inset-0 size-full object-cover object-[center_35%]',
            'portrait:static portrait:inset-auto portrait:h-auto portrait:max-h-[62dvh] portrait:w-full portrait:object-contain',
            // Fade the top and bottom edges of the picture into the page.
            'portrait:[-webkit-mask-image:linear-gradient(to_bottom,transparent_0%,black_14%,black_72%,transparent_100%)]',
            'portrait:[mask-image:linear-gradient(to_bottom,transparent_0%,black_14%,black_72%,transparent_100%)]',
          ].join(' ')}
        />
      </div>
      <div className="absolute inset-x-0 bottom-0 h-3/5 bg-gradient-to-b from-transparent to-background portrait:hidden" aria-hidden />

      <h1 className="sr-only">Photo Studio</h1>

      <div className="relative flex w-full flex-wrap justify-center gap-4 px-4 pb-[max(3rem,calc(env(safe-area-inset-bottom)+1.5rem))] portrait:pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <Button
          size="lg"
          className="h-14 min-w-50 flex-[0_1_15rem] gap-2 text-lg font-bold"
          disabled={disabled}
          onClick={onUpload}
        >
          <Plus className="size-5.5" /> Upload photos
        </Button>
        <Button
          size="lg"
          variant="outline"
          className="h-14 min-w-50 flex-[0_1_15rem] gap-2 border-2 border-white bg-transparent text-lg font-bold text-white hover:bg-white/15 hover:text-white dark:border-white dark:bg-transparent dark:hover:bg-white/15"
          onClick={onOpenLibrary}
        >
          <LayoutGrid className="size-5.5" /> Open library
        </Button>
      </div>
    </main>
  )
}
