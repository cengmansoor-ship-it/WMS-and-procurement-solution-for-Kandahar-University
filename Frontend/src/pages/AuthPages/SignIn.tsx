import PageMeta from "../../components/common/PageMeta";
import AuthLayout from "./AuthPageLayout";
import SignInForm from "../../components/auth/SignInForm";

export default function SignIn() {
  return (
    <>
      <PageMeta
        title="ننوتل | د کندهار پوهنتون د ګدام او تدارکاتو سیستم"
        description="د کندهار پوهنتون د عمومي ګدام او تدارکاتو مدیریت سیستم ته ننوتل"
      />
      <AuthLayout>
        <SignInForm />
      </AuthLayout>
    </>
  );
}
