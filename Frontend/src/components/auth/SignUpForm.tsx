import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { ChevronLeftIcon, EyeCloseIcon, EyeIcon } from "../../icons";
import Label from "../form/Label";
import Input from "../form/input/InputField";
import Checkbox from "../form/input/Checkbox";
import { register } from "../../firebase/auth";
import { useLanguage } from "../../context/LanguageContext";

export default function SignUpForm() {
  const [showPassword, setShowPassword] = useState(false);
  const [isChecked, setIsChecked] = useState(false);
  const [fname, setFname] = useState("");
  const [lname, setLname] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const { pick } = useLanguage();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isChecked) {
      setError(pick(
        "لطفاً د شرایطو او مقرراتو سره موافقه وکړئ.",
        "لطفاً با شرایط و مقررات موافقت کنید."
      ));
      return;
    }
    setLoading(true);
    setError("");
    try {
      await register(email, password, `${fname} ${lname}`);
      navigate("/");
    } catch (err: any) {
      console.error(err);
      setError(pick(
        "خطا: د حساب په جوړولو کې ستونزه ده.",
        "خطا: مشکلی در ایجاد حساب کاربری رخ داد."
      ));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col flex-1 w-full overflow-y-auto lg:w-1/2 no-scrollbar" dir="rtl">
      <div className="w-full max-w-md mx-auto mb-5 sm:pt-10">
        <Link
          to="/"
          className="inline-flex items-center text-sm text-gray-500 transition-colors hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
        >
          <ChevronLeftIcon className="size-5" />
          {pick("لوحه اصلي ته تلل", "بازگشت به داشبورد")}
        </Link>
      </div>
      <div className="flex flex-col justify-center flex-1 w-full max-w-md mx-auto">
        <div>
          <div className="mb-5 sm:mb-8">
            <h1 className="mb-2 font-semibold text-gray-800 text-title-sm dark:text-white/90 sm:text-title-md">
              {pick("نوم لیکنه", "ثبت نام")}
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {pick(
                "خپل ایمیل او پاسورډ دننه کړئ!",
                "ایمیل و رمز عبور خود را وارد کنید!"
              )}
            </p>
          </div>
          <div>
            {error && (
              <div className="mb-4 p-3 rounded bg-red-100 text-red-700 text-sm dark:bg-red-900/30 dark:text-red-400 text-right font-medium">
                {error}
              </div>
            )}
            <form onSubmit={handleSubmit}>
              <div className="space-y-5">
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                  <div className="sm:col-span-1">
                    <Label>
                      {pick("لومړی نوم", "نام")}<span className="text-error-500">*</span>
                    </Label>
                    <Input
                      type="text"
                      id="fname"
                      name="fname"
                      placeholder={pick("خپل لومړی نوم ولیکئ", "نام خود را وارد کنید")}
                      value={fname}
                      onChange={(e) => setFname(e.target.value)}
                      required
                    />
                  </div>
                  <div className="sm:col-span-1">
                    <Label>
                      {pick("وروستی نوم", "نام خانوادگی")}<span className="text-error-500">*</span>
                    </Label>
                    <Input
                      type="text"
                      id="lname"
                      name="lname"
                      placeholder={pick("خپل وروستی نوم ولیکئ", "نام خانوادگی خود را وارد کنید")}
                      value={lname}
                      onChange={(e) => setLname(e.target.value)}
                      required
                    />
                  </div>
                </div>
                <div>
                  <Label>
                    {pick("ایمیل", "ایمیل")}<span className="text-error-500">*</span>
                  </Label>
                  <Input
                    type="email"
                    id="email"
                    name="email"
                    placeholder={pick("خپل ایمیل ولیکئ", "ایمیل خود را وارد کنید")}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <Label>
                    {pick("پاسورډ", "رمز عبور")}<span className="text-error-500">*</span>
                  </Label>
                  <div className="relative">
                    <Input
                      placeholder={pick("خپل پاسورډ ولیکئ", "رمز عبور خود را وارد کنید")}
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                    <span
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute z-30 -translate-y-1/2 cursor-pointer right-4 top-1/2"
                    >
                      {showPassword ? (
                        <EyeIcon className="fill-gray-500 dark:fill-gray-400 size-5" />
                      ) : (
                        <EyeCloseIcon className="fill-gray-500 dark:fill-gray-400 size-5" />
                      )}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Checkbox
                    className="w-5 h-5"
                    checked={isChecked}
                    onChange={setIsChecked}
                  />
                  <p className="inline-block font-normal text-gray-500 dark:text-gray-400">
                    {pick(
                      "د حساب جوړولو سره تاسو د ",
                      "با ایجاد حساب، با "
                    )}
                    <span className="text-gray-800 dark:text-white/90">
                      {pick("شرایطو او مقرراتو", "شرایط و مقررات")}
                    </span>
                    {pick(" سره موافق یاست", " و ")}
                    <span className="text-gray-800 dark:text-white">
                      {pick("او زموږ د رازداري کچه", "سیاست حریم خصوصی")}
                    </span>
                    {pick(" منئ.", " موافقت می‌کنید.")}
                  </p>
                </div>
                <div>
                  <button
                    type="submit"
                    className="flex items-center justify-center w-full px-4 py-3 text-sm font-medium text-white transition rounded-lg bg-brand-500 shadow-theme-xs hover:bg-brand-600 disabled:opacity-50"
                    disabled={loading}
                  >
                    {loading ? (
                      <span className="flex items-center gap-2">
                        <span>{pick("نوم لیکنه...", "در حال ثبت نام...")}</span>
                        <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                      </span>
                    ) : pick("نوم لیکنه", "ثبت نام")}
                  </button>
                </div>
              </div>
            </form>

            <div className="mt-5">
              <p className="text-sm font-normal text-center text-gray-700 dark:text-gray-400 sm:text-start">
                {pick("حساب لرئ؟", "حساب دارید؟")}{" "}
                <Link
                  to="/signin"
                  className="text-brand-500 hover:text-brand-600 dark:text-brand-400"
                >
                  {pick("ننوتل", "ورود")}
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
