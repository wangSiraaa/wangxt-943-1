import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Ship, Waves } from "lucide-react";
import { useAuthStore } from "@/store/authStore";

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const { login, isLoading } = useAuthStore();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      await login(username, password);
      navigate("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "登录失败");
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-navy relative overflow-hidden">
      <div className="absolute inset-0 opacity-10">
        <div className="absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-t from-nautical/40 to-transparent" />
        <Waves className="absolute bottom-4 left-1/4 w-64 h-64 text-nautical/20" />
        <Waves className="absolute bottom-8 right-1/4 w-48 h-48 text-nautical/15" />
        <Ship className="absolute top-1/4 right-1/4 w-32 h-32 text-nautical/10" />
      </div>

      <div className="relative w-full max-w-md mx-4 animate-fade-in">
        <div className="bg-navy-light border border-navy-lighter rounded-2xl shadow-2xl p-8">
          <div className="flex flex-col items-center mb-8">
            <div className="flex items-center justify-center w-16 h-16 rounded-full bg-nautical/20 mb-4">
              <Ship className="w-8 h-8 text-nautical-light" />
            </div>
            <h1 className="text-2xl font-bold text-gray-100">渔港进出港登记系统</h1>
            <p className="text-sm text-gray-500 mt-1">Fishing Port Entry/Exit Registration</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm text-gray-400 mb-1.5">用户名</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-4 py-2.5 bg-navy border border-navy-lighter rounded-lg text-gray-100 placeholder-gray-600 focus:outline-none focus:border-nautical focus:ring-1 focus:ring-nautical transition-colors"
                placeholder="请输入用户名"
                required
              />
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1.5">密码</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2.5 bg-navy border border-navy-lighter rounded-lg text-gray-100 placeholder-gray-600 focus:outline-none focus:border-nautical focus:ring-1 focus:ring-nautical transition-colors"
                placeholder="请输入密码"
                required
              />
            </div>

            {error && (
              <div className="px-3 py-2 bg-danger/15 border border-danger/30 rounded-lg text-sm text-danger-light">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 bg-nautical hover:bg-nautical-light disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
            >
              {isLoading ? "登录中..." : "登 录"}
            </button>
          </form>
        </div>

        <div className="flex items-center justify-center mt-6 gap-2 text-xs text-gray-600">
          <Waves className="w-3 h-3" />
          <span>渔港安全 · 进出有序</span>
          <Waves className="w-3 h-3" />
        </div>
      </div>
    </div>
  );
}
