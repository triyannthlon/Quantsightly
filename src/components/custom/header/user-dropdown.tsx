"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronDown, LogOut, LifeBuoy, Settings, User } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getDisplayName, getInitials } from "@/lib/helpers/user";

type UserDropdownProps = {
  name?: string;
  email: string;
  avatarSrc?: string;
};

/********************** UserDropdown *****/
export default function UserDropdown({ email, name, avatarSrc }: UserDropdownProps) {
  const displayName = getDisplayName(email, name);
  const initials = getInitials(displayName);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild className="cursor-pointer">
        <Button
          variant="ghost"
          className="h-auto px-0 py-0 bg-transparent hover:bg-transparent focus:bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 active:bg-transparent outline-none"
        >
          <span className="flex items-center text-sm font-medium">
            <Avatar className="mr-3 h-11 w-11">
              {avatarSrc && <AvatarImage src={avatarSrc} alt={displayName} />}
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>

            <span className="mr-1">{displayName}</span>

            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          </span>
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-65 rounded-xl p-3">
        <DropdownMenuLabel className="p-0">
          <div>
            <span className="block text-sm font-medium">{displayName}</span>
            <span className="text-xs text-muted-foreground">{email}</span>
          </div>
        </DropdownMenuLabel>

        <DropdownMenuSeparator className="my-3" />

        <DropdownMenuGroup>
          <DropdownMenuItem asChild className="cursor-pointer">
            <Link href="/profile" className="flex items-center gap-3">
              <User className="h-4 w-4" />
              Edit profile
            </Link>
          </DropdownMenuItem>

          <DropdownMenuItem asChild className="cursor-pointer">
            <Link href="/settings" className="flex items-center gap-3">
              <Settings className="h-4 w-4" />
              Account settings
            </Link>
          </DropdownMenuItem>

          <DropdownMenuItem asChild className="cursor-pointer">
            <Link href="/support" className="flex items-center gap-3">
              <LifeBuoy className="h-4 w-4" />
              Support
            </Link>
          </DropdownMenuItem>
        </DropdownMenuGroup>

        <DropdownMenuSeparator className="my-3" />

        <DropdownMenuItem asChild className="cursor-pointer">
          <Link href="/signin" className="flex items-center gap-3">
            <LogOut className="h-4 w-4" />
            Sign out
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
