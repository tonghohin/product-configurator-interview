export const Spinner = ({ label }: { label: string }) => (
	<span className="spinner-row">
		<span className="spinner" role="status" aria-label={label} />
		{label}
	</span>
);
