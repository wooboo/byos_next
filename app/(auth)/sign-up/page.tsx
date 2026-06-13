"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
	AuthFooterLink,
	AuthForm,
	AuthInputField,
	AuthMessage,
	AuthPageCard,
	AuthSubmitButton,
} from "@/components/auth/auth-form";
import { authClient } from "@/lib/auth/auth-client";

export default function SignUpPage() {
	const router = useRouter();
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [confirmPassword, setConfirmPassword] = useState("");
	const [name, setName] = useState("");
	const [error, setError] = useState("");
	const [isLoading, setIsLoading] = useState(false);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setError("");

		// Validate passwords match
		if (password !== confirmPassword) {
			setError("Passwords do not match");
			return;
		}

		// Validate password strength
		if (password.length < 8) {
			setError("Password must be at least 8 characters long");
			return;
		}

		setIsLoading(true);

		try {
			const { data, error: authError } = await authClient.signUp.email({
				email,
				password,
				name,
			});

			if (authError) {
				setError(authError.message || "Failed to sign up. Please try again.");
				setIsLoading(false);
				return;
			}

			if (data) {
				// Redirect to home page on successful sign up
				router.push("/");
				router.refresh();
			}
		} catch (_err) {
			setError("An unexpected error occurred. Please try again.");
			setIsLoading(false);
		}
	};

	return (
		<AuthPageCard
			title="Create Account"
			description="Enter your information to create a new account"
		>
			<AuthForm onSubmit={handleSubmit}>
				{error && <AuthMessage>{error}</AuthMessage>}
				<AuthInputField
					id="name"
					label="Name"
					type="text"
					placeholder="John Doe"
					value={name}
					onChange={(e) => setName(e.target.value)}
					autoComplete="name"
					disabled={isLoading}
				/>
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
				<AuthInputField
					id="password"
					label="Password"
					type="password"
					placeholder="••••••••"
					value={password}
					onChange={(e) => setPassword(e.target.value)}
					autoComplete="new-password"
					disabled={isLoading}
					helpText="Must be at least 8 characters long"
				/>
				<AuthInputField
					id="confirmPassword"
					label="Confirm Password"
					type="password"
					placeholder="••••••••"
					value={confirmPassword}
					onChange={(e) => setConfirmPassword(e.target.value)}
					autoComplete="new-password"
					disabled={isLoading}
				/>
				<AuthSubmitButton
					isLoading={isLoading}
					loadingLabel="Creating account..."
				>
					Create Account
				</AuthSubmitButton>
				<AuthFooterLink text="Already have an account?" href="/sign-in">
					Sign in
				</AuthFooterLink>
			</AuthForm>
		</AuthPageCard>
	);
}
