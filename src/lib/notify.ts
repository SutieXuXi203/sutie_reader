import { gooeyToast, type GooeyPromiseData, type GooeyToastOptions } from 'goey-toast';

type ToastVariant = 'default' | 'success' | 'error' | 'warning' | 'info';

type PromiseConfig<T> = {
  loading: string;
  success: string | ((data: T) => string);
  error: string | ((error: unknown) => string);
  loadingDescription?: string;
  successDescription?: string | ((data: T) => string);
  errorDescription?: string | ((error: unknown) => string);
};

const palette: Record<ToastVariant, Pick<GooeyToastOptions, 'fillColor' | 'borderColor'>> = {
  default: {
    fillColor: 'var(--card)',
    borderColor: 'var(--border)',
  },
  success: {
    fillColor: 'var(--card)',
    borderColor: 'var(--primary)',
  },
  info: {
    fillColor: 'var(--card)',
    borderColor: 'var(--primary)',
  },
  warning: {
    fillColor: 'var(--card)',
    borderColor: 'var(--primary)',
  },
  error: {
    fillColor: 'var(--card)',
    borderColor: 'var(--primary)',
  },
};

export type NotifyExtra =
  | string
  | {
      description?: string;
      action?: {
        label: string;
        onClick: () => void;
        successLabel?: string;
      };
      duration?: number;
    };

const getOptions = (
  type: ToastVariant,
  defaultDuration: number,
  extra?: NotifyExtra
): GooeyToastOptions => {
  const description = typeof extra === 'string' ? extra : extra?.description;
  const action = typeof extra === 'object' ? extra?.action : undefined;
  const duration = (typeof extra === 'object' && extra?.duration) || defaultDuration;

  return {
    description,
    timing: { displayDuration: duration },
    showProgress: true,
    borderWidth: 1.25,
    preset: 'smooth',
    ...palette[type],
    ...(action ? { action } : {}),
    classNames: {
      wrapper: `app-toast app-toast--${type}`,
      content: 'app-toast-content',
      title: 'app-toast-title',
      description: 'app-toast-description',
      actionWrapper: 'app-toast-action-wrapper',
      actionButton: 'app-toast-action-button',
    },
  };
};

const getPromiseOptions = <T>(config: PromiseConfig<T>): GooeyPromiseData<T> => ({
  loading: config.loading,
  success: config.success,
  error: config.error,
  description: {
    loading: config.loadingDescription,
    success: config.successDescription,
    error: config.errorDescription,
  },
  borderWidth: 1.25,
  preset: 'smooth',
  ...palette.default,
  classNames: {
    wrapper: 'app-toast app-toast--promise',
    content: 'app-toast-content',
    title: 'app-toast-title',
    description: 'app-toast-description',
    actionButton: 'app-toast-action-button',
  },
});

export const notify = {
  success: (title: string, extra?: NotifyExtra) =>
    gooeyToast.success(title, getOptions('success', 3500, extra)),
  error: (title: string, extra?: NotifyExtra) =>
    gooeyToast.error(title, getOptions('error', 4000, extra)),
  info: (title: string, extra?: NotifyExtra) =>
    gooeyToast.info(title, getOptions('info', 3500, extra)),
  warning: (title: string, extra?: NotifyExtra) =>
    gooeyToast.warning(title, getOptions('warning', 4000, extra)),
  show: (title: string, extra?: NotifyExtra) =>
    gooeyToast(title, getOptions('default', 3500, extra)),
  promise: <T>(promise: Promise<T>, config: PromiseConfig<T>) =>
    gooeyToast.promise(promise, getPromiseOptions(config)),
};
