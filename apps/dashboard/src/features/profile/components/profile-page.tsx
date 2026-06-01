import { UserCircle } from "lucide-react";

import { PageHeader } from "@/components/ui/page-header";

import { useProfile } from "../hooks/use-profile";

import { ProfileError } from "./profile-error";
import { ProfileForm } from "./profile-form";
import { ProfileSkeleton } from "./profile-skeleton";

export function ProfilePage() {
  const { data, isLoading, isError, error, refetch, isFetching } = useProfile();

  const header = (
    <PageHeader icon={<UserCircle />} title="Perfil" description="Gestiona tu cuenta" />
  );

  if (isError) {
    return (
      <div className="space-y-6 max-w-lg">
        {header}
        <ProfileError
          message={error instanceof Error ? error.message : "Error desconocido"}
          onRetry={() => refetch()}
          retrying={isFetching}
        />
      </div>
    );
  }

  if (isLoading || !data) {
    return (
      <div className="space-y-6 max-w-lg">
        {header}
        <ProfileSkeleton />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-lg">
      {header}
      <ProfileForm profile={data} />
    </div>
  );
}
