<?php

namespace App\Policies;

use App\Models\Organization;
use App\Models\User;

class OrganizationPolicy
{
    private function role(User $user, Organization $organization): ?string
    {
        return $user->membershipFor($organization->id)?->role;
    }

    public function view(User $user, Organization $organization): bool
    {
        return $this->role($user, $organization) !== null;
    }

    public function manage(User $user, Organization $organization): bool
    {
        return in_array($this->role($user, $organization), ['owner', 'admin'], true);
    }

    public function write(User $user, Organization $organization): bool
    {
        return in_array($this->role($user, $organization), ['owner', 'admin', 'member'], true);
    }

    public function own(User $user, Organization $organization): bool
    {
        return $this->role($user, $organization) === 'owner' && $organization->owner_user_id === $user->id;
    }
}
