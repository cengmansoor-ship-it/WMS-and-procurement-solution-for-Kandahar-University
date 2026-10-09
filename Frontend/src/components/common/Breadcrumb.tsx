import { useLanguage } from "../../context/LanguageContext";

type BreadcrumbProps = {
    pageTitle?: string;
    title?: string;
};

export default function Breadcrumb({ pageTitle, title }: BreadcrumbProps) {
    const { splitPick } = useLanguage();
    const raw = pageTitle || title || "پاڼه";
    const displayTitle = splitPick(raw);
    const homeLabel = splitPick("عمومي پاڼه / صفحه اصلی");

    return (
        <div className="mb-6">
            <h2 className="text-xl font-semibold text-gray-800 dark:text-white/90">
                {displayTitle}
            </h2>
            <div className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                {homeLabel} / {displayTitle}
            </div>
        </div>
    );
}
