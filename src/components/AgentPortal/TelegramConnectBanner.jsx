import { useAuthStore } from '@/hooks/useAuth';
import { Send, CheckCircle2, ExternalLink } from 'lucide-react';

export function TelegramConnectBanner() {
    const { user } = useAuthStore();
    const isLinked = !!user?.TelegramChatID && user.TelegramChatID > 0;
    const botUsername = 'HGHSejahtera_Bot';
    const botUrl = `https://t.me/${botUsername}`;

    return (
        <div className="bg-gradient-to-r from-sky-500/10 via-indigo-500/10 to-blue-500/10 border border-sky-500/20 rounded-2xl p-5 mb-6 backdrop-blur-sm">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-start gap-4">
                    <div className="p-3 bg-sky-500 text-white rounded-xl shadow-md shadow-sky-500/20 flex-shrink-0">
                        <Send className="w-6 h-6" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-gray-900 text-base">
                                Fast AWB Upload via Telegram Bot
                            </h3>
                            {isLinked ? (
                                <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                                    <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Linked
                                </span>
                            ) : (
                                <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                                    Not Linked
                                </span>
                            )}
                        </div>
                        <p className="text-sm text-gray-600 mt-1 leading-relaxed">
                            {isLinked
                                ? `Your Telegram account is connected. You can share multi-page TikTok AWB PDFs directly to @${botUsername} from your phone.`
                                : `Connect your Telegram account for instant, one-tap mobile AWB uploads directly to @${botUsername}.`}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                    <a
                        href={botUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-sky-600 hover:bg-sky-700 text-white text-sm font-medium px-4 py-2.5 rounded-xl shadow-sm transition-all hover:shadow duration-200"
                    >
                        <span>{isLinked ? 'Open Bot' : 'Connect Bot'}</span>
                        <ExternalLink className="w-4 h-4" />
                    </a>
                </div>
            </div>
        </div>
    );
}
