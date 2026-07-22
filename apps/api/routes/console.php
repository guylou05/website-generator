<?php

use Illuminate\Support\Facades\Schedule;

Schedule::command('jobs:recover-stale')->everyMinute()->withoutOverlapping();
