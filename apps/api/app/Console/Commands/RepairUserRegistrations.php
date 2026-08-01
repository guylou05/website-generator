<?php

namespace App\Console\Commands;

use App\Models\Organization;
use App\Models\OrganizationMembership;
use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class RepairUserRegistrations extends Command
{
    protected $signature = 'users:repair-registration {--dry-run : Report inconsistencies without changing data} {--fix : Safely add or correct relationships}';

    protected $description = 'Report and safely repair incomplete customer registrations';

    public function handle(): int
    {
        if ($this->option('dry-run') && $this->option('fix')) {
            $this->error('Choose either --dry-run or --fix.');

            return self::INVALID;
        }
        $fix = (bool) $this->option('fix');
        $issues = 0;
        User::query()->each(function (User $user) use ($fix, &$issues) {
            $owned = Organization::where('owner_user_id', $user->id)->orderBy('created_at')->get();
            if ($owned->isEmpty()) {
                $this->warn("User {$user->id} has no organization.");
                $issues++;
                if ($fix) {
                    DB::transaction(function () use ($user) {
                        $name = $user->name."'s Organization";
                        $organization = Organization::create(['name' => $name, 'slug' => Str::slug($name).'-'.strtolower(Str::random(6)), 'owner_user_id' => $user->id]);
                        OrganizationMembership::create(['organization_id' => $organization->id, 'user_id' => $user->id, 'role' => 'owner', 'status' => 'active', 'joined_at' => now()]);
                        $user->forceFill(['current_organization_id' => $organization->id])->save();
                    });
                }

                return;
            }
            foreach ($owned as $organization) {
                $membership = OrganizationMembership::where('organization_id', $organization->id)->where('user_id', $user->id)->first();
                if (! $membership || $membership->role !== 'owner' || $membership->status !== 'active') {
                    $this->warn("Organization {$organization->id} has an inconsistent owner membership.");
                    $issues++;
                    if ($fix) {
                        OrganizationMembership::updateOrCreate(['organization_id' => $organization->id, 'user_id' => $user->id], ['role' => 'owner', 'status' => 'active', 'joined_at' => $membership?->joined_at ?? now()]);
                    }
                }
            }
            if (! $user->currentOrganization || ! $user->membershipFor($user->current_organization_id)) {
                $this->warn("User {$user->id} has an invalid current_organization_id.");
                $issues++;
                if ($fix) {
                    $user->forceFill(['current_organization_id' => $owned->first()->id])->save();
                }
            }
        });
        Organization::whereDoesntHave('memberships')->each(function (Organization $organization) use (&$issues) {
            $this->warn("Organization {$organization->id} is orphaned (no memberships); no automatic change made.");
            $issues++;
        });
        $this->info(($fix ? 'Repair complete' : 'Dry-run complete').": {$issues} issue(s) found. No data was deleted.");

        return self::SUCCESS;
    }
}
