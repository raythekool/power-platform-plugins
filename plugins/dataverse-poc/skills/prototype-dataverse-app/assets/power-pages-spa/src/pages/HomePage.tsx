import type { Screen } from '../generated/screens';
import Sections from './Sections';

export default function HomePage({ screen }: { screen: Screen }) {
  return (
    <>
      <div className="hero">
        <h1>{screen.hero?.title ?? screen.displayName}</h1>
        {screen.hero?.text && <p>{screen.hero.text}</p>}
      </div>
      <Sections sections={screen.sections} />
    </>
  );
}
