import { useRef } from 'react';
import { usePoseEngine } from '@/ui/hooks/usePoseEngine';
import { LiveDebug } from '@/ui/screens/LiveDebug';

const ERROR_TEXT: Record<string, string> = {
  denied: 'Доступ к камере запрещён. Разрешите камеру в настройках браузера и обновите страницу.',
  notFound: 'Камера не найдена. Подключите веб-камеру.',
  inUse: 'Камера занята другим приложением (Zoom, Teams…). Закройте его и обновите страницу.',
  insecure: 'Камера работает только по HTTPS.',
  unknown: 'Не удалось открыть камеру.',
  model: 'Не удалось загрузить модель распознавания. Проверьте интернет и обновите страницу.',
};

export function App() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const { status, start } = usePoseEngine(videoRef);

  return (
    <main className="screen">
      <video ref={videoRef} className="camera" playsInline muted />
      {status.state === 'ready' && (
        <LiveDebug loop={status.loop} info={`${status.tracker.model}/${status.tracker.delegate}`} />
      )}
      {status.state !== 'ready' && (
        <div className="screen center layer">
          <h1 className="title">QOZĞAL</h1>
          <p className="subtitle">Путь Батыра — AI-тренер, которым управляешь телом</p>
          {status.state === 'idle' && (
            <button className="btn-primary" onClick={() => start()}>
              Начать
            </button>
          )}
          {status.state === 'loading' && (
            <p className="subtitle">
              {status.step === 'camera' ? 'Разрешите доступ к камере…' : 'Загружаем модель…'}
            </p>
          )}
          {status.state === 'error' && <p className="error">{ERROR_TEXT[status.kind]}</p>}
          <p className="privacy">
            🔒 Видео не покидает ваше устройство — всё обрабатывается в браузере
          </p>
        </div>
      )}
    </main>
  );
}
