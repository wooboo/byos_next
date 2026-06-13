"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import {
	AuthFooterLink,
	AuthForm,
	AuthInputField,
	AuthMessage,
	AuthPageCard,
	AuthSubmitButton,
} from "@/components/auth/auth-form";
import { authClient } from "@/lib/auth/auth-client";

export default function RecoverPage() {
	return (
		<Suspense>
			<RecoverPageContent />
		</Suspense>
	);
}

function RecoverPageContent() {
	const router = useRouter();
	const searchParams = useSearchParams();
	const token = searchParams?.get("token") ?? null;
	const error = searchParams?.get("error") ?? null;

	const [email, setEmail] = useState("");
	const [newPassword, setNewPassword] = useState("");
	const [confirmPassword, setConfirmPassword] = useState("");
	const [errorMessage, setErrorMessage] = useState("");
	const [successMessage, setSuccessMessage] = useState("");
	const [isLoading, setIsLoading] = useState(false);

	// Check if there's an error from the email link
	useEffect(() => {
		if (error === "INVALID_TOKEN") {
			setErrorMessage(
				"The reset link is invalid or has expired. Please request a new one.",
			);
		}
	}, [error]);

	const handleRequestReset = async (e: React.FormEvent) => {
		e.preventDefault();
		setErrorMessage("");
		setSuccessMessage("");
		setIsLoading(true);

		try {
			// @ts-expect-error - forgetPassword method exists but types may not be updated
			const { error: requestError } = await authClient.forgetPassword({
				email,
				redirectTo: `${window.location.origin}/recover`,
			});

			if (requestError) {
				setErrorMessage(
					requestError.message ||
						"Failed to send reset email. Please try again.",
				);
				setIsLoading(false);
				return;
			}

			setSuccessMessage(
				"If an account exists with this email, you will receive a password reset link shortly.",
			);
			setIsLoading(false);
		} catch (_err) {
			setErrorMessage("An unexpected error occurred. Please try again.");
			setIsLoading(false);
		}
	};

	const handleResetPassword = async (e: React.FormEvent) => {
		e.preventDefault();
		setErrorMessage("");
		setSuccessMessage("");

		// Validate passwords match
		if (newPassword !== confirmPassword) {
			setErrorMessage("Passwords do not match");
			return;
		}

		// Validate password strength
		if (newPassword.length < 8) {
			setErrorMessage("Password must be at least 8 characters long");
			return;
		}

		if (!token) {
			setErrorMessage("Invalid reset token");
			return;
		}

		setIsLoading(true);

		try {
			const { error: resetError } = await authClient.resetPassword({
				newPassword,
				token,
			});

			if (resetError) {
				setErrorMessage(
					resetError.message || "Failed to reset password. Please try again.",
				);
				setIsLoading(false);
				return;
			}

			setSuccessMessage(
				"Your password has been reset successfully. Redirecting to sign in...",
			);
			setTimeout(() => {
				router.push("/sign-in");
			}, 2000);
		} catch (_err) {
			setErrorMessage("An unexpected error occurred. Please try again.");
			setIsLoading(false);
		}
	};

	// Show reset password form if token is present
	if (token && error !== "INVALID_TOKEN") {
		return (
			<AuthPageCard
				title="Reset Password"
				description="Enter your new password below"
			>
				<AuthForm onSubmit={handleResetPassword}>
					{errorMessage && <AuthMessage>{errorMessage}</AuthMessage>}
					{successMessage && (
						<AuthMessage tone="success">{successMessage}</AuthMessage>
					)}
					<AuthInputField
						id="newPassword"
						label="New Password"
						type="password"
						placeholder="••••••••"
						value={newPassword}
						onChange={(e) => setNewPassword(e.target.value)}
						autoComplete="new-password"
						disabled={isLoading}
						helpText="Must be at least 8 characters long"
					/>
					<AuthInputField
						id="confirmPassword"
						label="Confirm New Password"
						type="password"
						placeholder="••••••••"
						value={confirmPassword}
						onChange={(e) => setConfirmPassword(e.target.value)}
						autoComplete="new-password"
						disabled={isLoading}
					/>
					<AuthSubmitButton isLoading={isLoading} loadingLabel="Resetting...">
						Reset Password
					</AuthSubmitButton>
					<AuthFooterLink text="Remember your password?" href="/sign-in">
						Sign in
					</AuthFooterLink>
				</AuthForm>
			</AuthPageCard>
		);
	}

	// Show request reset form by default
	return (
		<AuthPageCard
			title="Recover Password"
			description="Enter your email address and we'll send you a link to reset your password"
		>
			<AuthForm onSubmit={handleRequestReset}>
				{errorMessage && <AuthMessage>{errorMessage}</AuthMessage>}
				{successMessage && (
					<AuthMessage tone="success">{successMessage}</AuthMessage>
				)}
				<AuthInputField
					id="email"
					label="Email"
					type="email"
					placeholder="you@example.com"
					value={email}
					onChange={(e) => setEmail(e.target.value)}
					autoComplete="email"
					disabled={isLoading}
				/>
				<AuthSubmitButton isLoading={isLoading} loadingLabel="Sending...">
					Send Reset Link
				</AuthSubmitButton>
				<AuthFooterLink text="Remember your password?" href="/sign-in">
					Sign in
				</AuthFooterLink>
			</AuthForm>
		</AuthPageCard>
	);
}
