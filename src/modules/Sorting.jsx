import React, { useEffect } from "react";
import { CheckCircle } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import ModuleHeader from "../components/ModuleHeader";
import ProgressBar from "../components/common/ProgressBar";

import Page1 from "../components/Sorting/Page1";
import Page2 from "../components/Sorting/Page2";
import Page3 from "../components/Sorting/Page3";
import PageAssessment from "../components/Sorting/PageAssessment";

import { useModuleProgress } from "../services/useModuleProgress";
import Page0 from "../components/Sorting/Page0";
import Page4 from "../components/Sorting/Page4";

import { logActivity } from "../services/activityService";
import Page5 from "../components/Sorting/Page5";

const Sorting = () => {
  const navigate = useNavigate();
  const { page } = useParams();

  const pages = [
    <Page0 />,
    <Page1 />,
    <Page2 />,
    <Page3 />,
    <Page4 />,
    // <Page5 />,
  ];
  const totalPages = pages.length;

  const pageIndex = Math.min((Number(page) || 1) - 1, totalPages - 1);

  const { currentPage, setCurrentPage, isFinished, finishModule, progress } =
    useModuleProgress("sorting", totalPages);

  useEffect(() => {
    setCurrentPage(pageIndex);

    if (!isFinished) {
      setCurrentPage((prev) => {
        if (pageIndex > prev) return pageIndex;
        return prev;
      });

      logActivity("Sorting Algorithms");
    }
  }, [pageIndex, setCurrentPage, isFinished]);

  const goNext = () => {
    if (currentPage < totalPages - 1) {
      navigate(`/modules/sorting/${currentPage + 2}`);
    } else {
      finishModule();
      navigate("/modules", { state: { route: "sorting" } });
    }
  };

  const goPrev = () => {
    if (currentPage > 0) {
      navigate(`/modules/sorting/${currentPage}`);
    }
  };

  return (
    <div className="h-[calc(100vh)] overflow-y-auto p-4 bg-base-100 space-y-4">
      <ModuleHeader />
      {/* <ProgressBar progress={progress} /> */}

      {pages[currentPage]}

      <div className="flex justify-between items-center">
        <button
          onClick={goPrev}
          disabled={currentPage === 0}
          className="btn btn-outline"
        >
          Previous
        </button>

        <span className="text-sm font-semibold">
          Page {currentPage + 1} / {totalPages}
        </span>

        {currentPage < totalPages - 1 ? (
          <button onClick={goNext} className="btn btn-primary">
            Next
          </button>
        ) : (
          <button
            onClick={() => {
              finishModule();
              navigate("/modules", { state: { route: "sorting" } });
            }}
            className="btn btn-success flex items-center gap-2"
          >
            <CheckCircle className="w-5 h-5" />
            Finish Module
          </button>
        )}
      </div>
    </div>
  );
};

export default Sorting;
