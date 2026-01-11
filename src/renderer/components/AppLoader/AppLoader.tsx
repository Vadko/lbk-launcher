import { motion } from 'framer-motion';
import logo from '../../../../resources/logo.svg';

interface AppLoaderProps {
  status: 'syncing' | 'ready' | 'error' | 'loading';
}

export const AppLoader = ({ status }: AppLoaderProps) => {
  const getStatusText = () => {
    switch (status) {
      case 'syncing':
        return 'Синхронізація';
      case 'error':
        return "Помилка з'єднання";
      case 'loading':
      default:
        return 'Завантаження';
    }
  };

  return (
    <motion.div
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className="app-loader fixed inset-0 bg-[#0a0a0f] flex flex-col items-center justify-center z-[9999] overflow-hidden"
    >
      {/* Subtle gradient background */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-color-main/10" />

      {/* Animated glow behind logo */}
      <motion.div
        className="absolute w-64 h-64 rounded-full bg-gradient-to-r from-color-accent/20 to-color-main/20 blur-3xl"
        animate={{
          scale: [1, 1.2, 1],
          opacity: [0.3, 0.5, 0.3],
        }}
        transition={{
          duration: 3,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />

      {/* Main content */}
      <div className="relative z-10 flex flex-col items-center">
        {/* Logo */}
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="mb-6"
        >
          <img
            src={logo}
            alt="LBK Logo"
            className="w-24 h-24 drop-shadow-2xl"
          />
        </motion.div>

        {/* App name */}
        <motion.h1
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="text-3xl font-bold bg-gradient-to-r from-color-accent to-color-main bg-clip-text text-transparent mb-2"
        >
          LBK Launcher
        </motion.h1>

        {/* Tagline */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.6 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="text-text-muted text-sm mb-12"
        >
          Українізатор ігор
        </motion.p>

        {/* Loading indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="flex flex-col items-center"
        >
          {status !== 'error' ? (
            <>
              {/* Animated dots */}
              <div className="flex gap-1.5 mb-3">
                {[0, 1, 2].map((i) => (
                  <motion.div
                    key={i}
                    className="w-2 h-2 rounded-full bg-gradient-to-r from-color-accent to-color-main"
                    animate={{
                      scale: [1, 1.3, 1],
                      opacity: [0.5, 1, 0.5],
                    }}
                    transition={{
                      duration: 1,
                      repeat: Infinity,
                      delay: i * 0.15,
                      ease: 'easeInOut',
                    }}
                  />
                ))}
              </div>
              {/* Status text */}
              <span className="text-text-muted/70 text-xs tracking-wider uppercase">
                {getStatusText()}
              </span>
            </>
          ) : (
            <>
              {/* Error icon */}
              <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center mb-3">
                <svg
                  className="w-5 h-5 text-red-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </div>
              <span className="text-red-400 text-xs tracking-wider uppercase">
                {getStatusText()}
              </span>
              <span className="text-text-muted/50 text-xs mt-1">
                Перезапустіть застосунок
              </span>
            </>
          )}
        </motion.div>
      </div>

      {/* Bottom decoration line */}
      <motion.div
        className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-accent/30 to-transparent"
        animate={{
          opacity: [0.3, 0.6, 0.3],
        }}
        transition={{
          duration: 2,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />
    </motion.div>
  );
};
