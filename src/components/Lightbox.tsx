import { useModal } from '../lib/useModal';

interface Props {
  media: { url: string; kind: 'img' | 'video' } | null;
  onClose: () => void;
}

export default function Lightbox({ media, onClose }: Props) {
  useModal(!!media, onClose);
  return (
    <div className={'lightbox' + (media ? ' show' : '')} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <span className="x" onClick={onClose}>&times;</span>
      <div>
        {media && (media.kind === 'video'
          ? <video src={media.url} controls autoPlay />
          : <img src={media.url} alt="" />)}
      </div>
    </div>
  );
}
